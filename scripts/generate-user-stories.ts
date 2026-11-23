/**
 * Generate per-module user-story Markdown from spec annotations.
 *
 * Walks every tests/*.spec.ts, extracts each test()'s 5-field annotations,
 * synthesizes a user-story narrative from (testType, title, role, module),
 * and writes one Markdown file per spec to docs/user-stories/.
 *
 * Run: bun docs:user-stories
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import * as ts from "typescript";
import { TEST_USERS } from "../tests/test-users";

const REPO_ROOT = resolve(__dirname, "..");
const TESTS_DIR = join(REPO_ROOT, "tests");
const OUT_DIR = join(REPO_ROOT, "docs", "user-stories");

const TC_REGEX = /\b(TC-[A-Z]{2,5}-\d{6}|TCS?-[A-Z]{0,4}\d{2,})\b/;

const EMAIL_TO_ROLE = new Map<string, string>(
  TEST_USERS.map((u) => [u.email, u.role]),
);

const MODULE_NAME_OVERRIDES: Record<string, string> = {
  "001-login": "Login & Logout",
  "150-vendor": "Vendor",
  "201-my-approvals": "My Approvals",
  "501-grn": "GRN",
  "301-pr": "Purchase Request",
  "310-pr-template": "Purchase Request Template",
  "401-po": "Purchase Order",
  "601-cn": "Credit Note",
  "602-cn-reason": "Credit Note Reason",
  "159-pl": "Price List",
  "160-pl-template": "Price List Template",
  "701-sr": "Store Requisition",
  "312-pr-doc-flow": "Purchase Request — Doc Flow (movement suite)",
  "404-po-doc-flow": "Purchase Order — Doc Flow (movement suite)",
  "502-grn-doc-flow": "GRN — Doc Flow (movement suite)",
  "603-cn-doc-flow": "Credit Note — Doc Flow (movement suite)",
  "702-sr-doc-flow": "Store Requisition — Doc Flow (movement suite)",
  "721-sr-issue-doc-flow": "Store Requisition → Issue — Doc Flow (movement suite)",
  "731-inventory-adjustment": "Inventory Adjustment — Doc Flow",
  "732-inventory-adjustment-stock": "Inventory Adjustment — Stock and Cost",
};

interface Annotations {
  preconditions: string;
  steps: string;
  expected: string;
  priority: string;
  testType: string;
  note: string;
}

interface TCRow {
  testId: string;
  title: string;
  skipped: boolean;
  ann: Annotations;
}

const EMPTY_ANN: Annotations = {
  preconditions: "",
  steps: "",
  expected: "",
  priority: "",
  testType: "",
  note: "",
};

function moduleNameFromBasename(specBase: string): string {
  if (MODULE_NAME_OVERRIDES[specBase]) return MODULE_NAME_OVERRIDES[specBase];
  const tail = specBase.replace(/^\d+-/, "");
  return tail
    .split("-")
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

function collectConstStrings(
  src: ts.SourceFile,
): Map<string, string | undefined> {
  const map = new Map<string, string | undefined>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          const init = decl.initializer;
          if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
            map.set(decl.name.text, init.text);
          } else {
            map.set(decl.name.text, undefined);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return map;
}

function literalText(node: ts.Expression | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return undefined;
}

function resolveStringValue(
  node: ts.Expression | undefined,
  consts: Map<string, string | undefined>,
): string | undefined {
  const lit = literalText(node);
  if (lit !== undefined) return lit;
  if (node && ts.isIdentifier(node)) return consts.get(node.text);
  return undefined;
}

interface LoopContext {
  loopVar: string;
  user: { role: string; email: string };
  recordConsts: Map<string, Map<string, string>>;
}

/**
 * Evaluate a string expression: literal, or template-expression whose
 * substitutions resolve via the supplied loop context. Returns undefined if
 * unresolvable.
 */
function evalStringExpression(
  expr: ts.Expression | undefined,
  loop?: LoopContext,
): string | undefined {
  if (!expr) return undefined;
  const lit = literalText(expr);
  if (lit !== undefined) return lit;
  if (loop && ts.isTemplateExpression(expr)) {
    let text = expr.head.text;
    for (const span of expr.templateSpans) {
      const sub = resolveLoopSubstitution(
        span.expression,
        loop.loopVar,
        loop.user,
        loop.recordConsts,
      );
      if (sub === undefined) return undefined;
      text += sub + span.literal.text;
    }
    return text;
  }
  return undefined;
}

function readAnnotationArray(
  arr: ts.Expression,
  loop?: LoopContext,
): Partial<Annotations> {
  const out: Partial<Annotations> = {};
  if (!ts.isArrayLiteralExpression(arr)) return out;
  for (const el of arr.elements) {
    if (!ts.isObjectLiteralExpression(el)) continue;
    let typeKey = "";
    let descVal: string | undefined;
    for (const prop of el.properties) {
      if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
      const key = prop.name.text;
      if (key === "type") {
        const v = evalStringExpression(prop.initializer, loop);
        if (v !== undefined) typeKey = v.toLowerCase();
      } else if (key === "description") {
        descVal = evalStringExpression(prop.initializer, loop);
      }
    }
    if (!typeKey || descVal === undefined) continue;
    switch (typeKey) {
      case "preconditions":
      case "precondition":
        out.preconditions = (out.preconditions ?? "") + (out.preconditions ? "\n" : "") + descVal;
        break;
      case "steps":
      case "step":
        out.steps = (out.steps ?? "") + (out.steps ? "\n" : "") + descVal;
        break;
      case "expected":
      case "expectedresult":
      case "expected result":
        out.expected = (out.expected ?? "") + (out.expected ? "\n" : "") + descVal;
        break;
      case "priority":
        out.priority = descVal;
        break;
      case "testtype":
      case "test type":
      case "type":
        out.testType = descVal;
        break;
      case "note":
      case "notes":
        out.note = (out.note ?? "") + (out.note ? "\n" : "") + descVal;
        break;
    }
  }
  return out;
}

function findAnnotationProperty(
  obj: ts.ObjectLiteralExpression,
): ts.Expression | undefined {
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
    if (prop.name.text === "annotation") return prop.initializer;
  }
  return undefined;
}

function isTestLikeCall(node: ts.CallExpression): { skipped: boolean } | null {
  const first = node.arguments[0];
  if (!first) return null;
  const text = literalText(first);
  if (!text) return null;
  if (!TC_REGEX.test(text)) return null;
  let skipped = false;
  const expr = node.expression;
  if (ts.isPropertyAccessExpression(expr) && expr.name.text === "skip") skipped = true;
  return { skipped };
}

/**
 * Read a top-level `const NAME: Record<string, string> = { Role: "TC-L01", ... }`
 * and return the inner mapping.
 */
function collectStringRecordConsts(
  src: ts.SourceFile,
): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        if (!ts.isObjectLiteralExpression(decl.initializer)) continue;
        const inner = new Map<string, string>();
        for (const prop of decl.initializer.properties) {
          if (!ts.isPropertyAssignment(prop)) continue;
          let key: string | undefined;
          if (ts.isIdentifier(prop.name)) key = prop.name.text;
          else if (ts.isStringLiteral(prop.name)) key = prop.name.text;
          if (!key) continue;
          const val = literalText(prop.initializer);
          if (val !== undefined) inner.set(key, val);
        }
        if (inner.size > 0) out.set(decl.name.text, inner);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return out;
}

/**
 * Walk up parents to find an enclosing `for (const X of TEST_USERS)` loop.
 * Returns the loop variable name (e.g. "user") if found, or undefined.
 */
function findEnclosingTestUsersLoop(node: ts.Node): string | undefined {
  let cur: ts.Node | undefined = node.parent;
  while (cur) {
    if (
      ts.isForOfStatement(cur) &&
      ts.isVariableDeclarationList(cur.initializer) &&
      cur.initializer.declarations.length === 1 &&
      ts.isIdentifier(cur.initializer.declarations[0].name) &&
      ts.isIdentifier(cur.expression) &&
      cur.expression.text === "TEST_USERS"
    ) {
      return cur.initializer.declarations[0].name.text;
    }
    cur = cur.parent;
  }
  return undefined;
}

function resolveLoopSubstitution(
  expr: ts.Expression,
  loopVar: string,
  user: { role: string; email: string },
  recordConsts: Map<string, Map<string, string>>,
): string | undefined {
  if (
    ts.isPropertyAccessExpression(expr) &&
    ts.isIdentifier(expr.expression) &&
    expr.expression.text === loopVar
  ) {
    if (expr.name.text === "role") return user.role;
    if (expr.name.text === "email") return user.email;
  }
  if (
    ts.isElementAccessExpression(expr) &&
    ts.isIdentifier(expr.expression) &&
    ts.isPropertyAccessExpression(expr.argumentExpression) &&
    ts.isIdentifier(expr.argumentExpression.expression) &&
    expr.argumentExpression.expression.text === loopVar &&
    expr.argumentExpression.name.text === "role"
  ) {
    const map = recordConsts.get(expr.expression.text);
    return map?.get(user.role);
  }
  return undefined;
}

function extractAnnotationsFromArgs(
  args: ts.NodeArray<ts.Expression>,
  loop?: LoopContext,
): Partial<Annotations> {
  for (const arg of args) {
    if (ts.isObjectLiteralExpression(arg)) {
      const annProp = findAnnotationProperty(arg);
      if (annProp) return readAnnotationArray(annProp, loop);
    }
  }
  return {};
}

function extractTestCalls(
  src: ts.SourceFile,
): { testId: string; title: string; skipped: boolean; ann: Partial<Annotations> }[] {
  const out: { testId: string; title: string; skipped: boolean; ann: Partial<Annotations> }[] = [];
  const recordConsts = collectStringRecordConsts(src);

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      // Detect skip from receiver.
      let skipped = false;
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr) && expr.name.text === "skip") skipped = true;

      const titleNode = node.arguments[0];
      if (titleNode) {
        // 1. Static-string title (the common case).
        const lit = literalText(titleNode);
        if (lit !== undefined && TC_REGEX.test(lit)) {
          const idMatch = lit.match(TC_REGEX);
          if (idMatch) {
            const ann = extractAnnotationsFromArgs(node.arguments);
            out.push({ testId: idMatch[1], title: lit, skipped, ann });
          }
        }
        // 2. Template-literal title inside a for-of TEST_USERS loop.
        else if (ts.isTemplateExpression(titleNode)) {
          const loopVar = findEnclosingTestUsersLoop(node);
          if (loopVar) {
            // Per-user expansion: re-render BOTH the title AND annotations
            // for each TEST_USERS entry so descriptions like
            // `User ${user.email} ...` get filled in.
            for (const user of TEST_USERS) {
              const ctx: LoopContext = { loopVar, user, recordConsts };
              const title = evalStringExpression(titleNode, ctx);
              if (title === undefined) continue;
              const idMatch = title.match(TC_REGEX);
              if (!idMatch) continue;
              const ann = extractAnnotationsFromArgs(node.arguments, ctx);
              out.push({ testId: idMatch[1], title, skipped, ann });
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return out;
}

function findAuthRole(src: ts.SourceFile): string | undefined {
  let role: string | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "createAuthTest"
    ) {
      const email = literalText(node.arguments[0]);
      if (email) role = EMAIL_TO_ROLE.get(email);
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return role;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Helper-generated security cases
 * ─────────────────────────────────────────────────────────────────────── */

type SecurityHelper =
  | "addDialogSecurityCases"
  | "addPageFormSecurityCases"
  | "addListOnlySecurityCases";

interface SecurityCallInfo {
  helper: SecurityHelper;
  prefix: string;
  listPath: string;
  skipAuth: boolean;
}

function findSecurityHelperCalls(
  src: ts.SourceFile,
  consts: Map<string, string | undefined>,
): SecurityCallInfo[] {
  const out: SecurityCallInfo[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === "addDialogSecurityCases" ||
        node.expression.text === "addPageFormSecurityCases" ||
        node.expression.text === "addListOnlySecurityCases")
    ) {
      const helper = node.expression.text as SecurityHelper;
      const optsArg = node.arguments[1];
      if (optsArg && ts.isObjectLiteralExpression(optsArg)) {
        let prefix = "";
        let listPath = "";
        let skipAuth = false;
        for (const prop of optsArg.properties) {
          if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;
          const key = prop.name.text;
          if (key === "prefix") prefix = resolveStringValue(prop.initializer, consts) ?? "";
          else if (key === "listPath") listPath = resolveStringValue(prop.initializer, consts) ?? "";
          else if (key === "skipAuth") {
            if (prop.initializer.kind === ts.SyntaxKind.TrueKeyword) skipAuth = true;
          }
        }
        if (prefix && listPath) {
          out.push({ helper, prefix, listPath, skipAuth });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return out;
}

function synthesizeSecurityRows(info: SecurityCallInfo): TCRow[] {
  const { helper, prefix, listPath, skipAuth } = info;
  const tcXss = `TC-${prefix}-100001`;
  const tcSql = `TC-${prefix}-100002`;
  const tcLen = `TC-${prefix}-100003`;
  const tcAuth = `TC-${prefix}-100004`;

  const rows: TCRow[] = [];

  rows.push({
    testId: tcXss,
    title: `${tcXss} XSS payload ในชื่อต้องไม่รัน script`,
    skipped: false,
    ann: {
      ...EMPTY_ANN,
      preconditions: `Logged in user with permission to access ${listPath}; XSS dialog guard attached`,
      steps:
        helper === "addDialogSecurityCases"
          ? `1. เปิด list ${listPath}\n2. คลิก Add เพื่อเปิด dialog\n3. กรอก name ด้วย XSS payload "<script>alert('xss-e2e')</script>"\n4. กด Save`
          : helper === "addPageFormSecurityCases"
            ? `1. เปิด new form ของ ${listPath}\n2. กรอก code ด้วย random suffix\n3. กรอก name ด้วย XSS payload "<script>alert('xss-e2e')</script>"\n4. กด Save`
            : `1. เปิด list ${listPath}\n2. พิมพ์ XSS payload "<script>alert('xss-e2e')</script>" ลงในช่องค้นหา`,
      expected:
        helper === "addDialogSecurityCases"
          ? "ไม่มี browser alert/dialog จาก payload (script ไม่ถูก execute); หาก dialog ยังเปิดอยู่ก็ปิดได้ปกติ"
          : helper === "addPageFormSecurityCases"
            ? "ไม่มี browser alert/dialog จาก payload; URL ยังคงอยู่ภายใต้ /config/ (ฟอร์มอาจ reject หรือ save แบบ escaped)"
            : "ไม่มี browser alert/dialog จาก payload; ปุ่ม Add ยังคง visible (list ทำงานปกติ)",
      priority: "High",
      testType: "Security",
    },
  });

  rows.push({
    testId: tcSql,
    title:
      helper === "addListOnlySecurityCases"
        ? `${tcSql} SQL injection payload ในช่องค้นหาต้องไม่ crash`
        : `${tcSql} SQL injection payload ต้องไม่ทำให้ระบบ crash`,
    skipped: false,
    ann: {
      ...EMPTY_ANN,
      preconditions: `Logged in user with permission to access ${listPath}`,
      steps: `1. เปิด list ${listPath}\n2. พิมพ์ SQL injection payload "'; DROP TABLE users; --" ลงในช่องค้นหา`,
      expected: "หน้าไม่ crash; ปุ่ม Add ยังคง visible (list ทำงานปกติ)",
      priority: "High",
      testType: "Security",
    },
  });

  rows.push({
    testId: tcLen,
    title:
      helper === "addListOnlySecurityCases"
        ? `${tcLen} ค้นหาด้วย string ยาวมากต้องไม่ crash`
        : `${tcLen} ชื่อยาวเกิน maxLength ต้องถูกจำกัดที่ 100`,
    skipped: false,
    ann: {
      ...EMPTY_ANN,
      preconditions: `Logged in user with permission to access ${listPath}`,
      steps:
        helper === "addDialogSecurityCases"
          ? `1. เปิด list ${listPath}\n2. คลิก Add เพื่อเปิด dialog\n3. กรอก name ด้วย string ยาว 200 ตัวอักษร ('a' x 200)`
          : helper === "addPageFormSecurityCases"
            ? `1. เปิด new form ของ ${listPath}\n2. กรอก name ด้วย string ยาว 200 ตัวอักษร ('a' x 200)`
            : `1. เปิด list ${listPath}\n2. พิมพ์ string ยาว 200 ตัวอักษร ('a' x 200) ลงในช่องค้นหา`,
      expected:
        helper === "addListOnlySecurityCases"
          ? "หน้าไม่ crash; ปุ่ม Add ยังคง visible (list ทำงานปกติ)"
          : "ค่าใน input ถูก clamp ที่ ≤ 100 ตัวอักษร (maxLength enforced)",
      priority: "Medium",
      testType: "Validation",
    },
  });

  rows.push({
    testId: tcAuth,
    title: `${tcAuth} user สิทธิ์ต่ำเข้าหน้านี้ต้องไม่เห็นปุ่ม Add หรือถูก redirect`,
    skipped: skipAuth,
    ann: {
      ...EMPTY_ANN,
      preconditions: `Test user requestor@blueledgers.com (low-privilege role) มีอยู่จริง; module list path = ${listPath}`,
      steps: `1. เปิด browser context ใหม่\n2. login เป็น requestor@blueledgers.com\n3. ไปที่ ${listPath}`,
      expected: `User ถูก redirect ออกจาก ${listPath} หรือ ปุ่ม Add ไม่ปรากฏ (count = 0)`,
      priority: "High",
      testType: "Authorization",
    },
  });

  return rows;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Narrative templates
 * ─────────────────────────────────────────────────────────────────────── */

interface NarrativeRule {
  testType: string;
  match: (titleLower: string) => boolean;
  template: string;
}

const RULES: NarrativeRule[] = [
  {
    testType: "smoke",
    match: (t) => /\bหน้า\b|\blist\b|page\s*load|\bload\b/.test(t),
    template:
      "**As a** {role} user, **I want** the {module} list page to load successfully, **so that** I can manage {module} records.",
  },
  {
    testType: "smoke",
    match: (t) => /ปุ่ม\s*add|\badd\b\s*(button|visible)?|ปุ่ม/.test(t),
    template:
      "**As a** {role} user, **I want** to see the Add button on the {module} list, **so that** I can create new records.",
  },
  {
    testType: "smoke",
    match: (t) => /ค้นหา|search/.test(t),
    template:
      "**As a** {role} user, **I want** to type into the {module} search field, **so that** I can quickly locate existing records.",
  },
  {
    testType: "smoke",
    match: () => true,
    template:
      "**As a** {role} user, **I want** core {module} interactions to work, **so that** day-to-day usage stays smooth.",
  },
  {
    testType: "functional",
    match: (t) => /empty|ไม่มี|no\s*match|no\s*result/.test(t),
    template:
      "**As a** {role} user, **I want** a clear empty-state when no {module} records match my search, **so that** I know nothing was found.",
  },
  {
    testType: "functional",
    match: (t) => /pagination|หน้า\s*ถัดไป|page\s*\d/.test(t),
    template:
      "**As a** {role} user, **I want** to paginate through {module} records, **so that** I can browse large lists efficiently.",
  },
  {
    testType: "functional",
    match: (t) => /sort|เรียง/.test(t),
    template:
      "**As a** {role} user, **I want** to sort the {module} list, **so that** I can find records in a useful order.",
  },
  {
    testType: "functional",
    match: (t) => /filter|กรอง/.test(t),
    template:
      "**As a** {role} user, **I want** to filter the {module} list, **so that** I can narrow results to relevant records.",
  },
  {
    testType: "functional",
    match: () => true,
    template:
      "**As a** {role} user, **I want** this {module} interaction to behave as expected, **so that** the workflow stays predictable.",
  },
  {
    testType: "validation",
    match: () => true,
    template:
      "**As a** {role} user, **I want** the system to block invalid {module} submissions, **so that** data quality is preserved.",
  },
  {
    testType: "crud",
    match: (t) => /สร้าง|create|new|ใหม่|\badd\b/.test(t),
    template:
      "**As a** {role} user, **I want** to create a new {module} record, **so that** it becomes available for downstream operations.",
  },
  {
    testType: "crud",
    match: (t) => /แก้ไข|edit|update/.test(t),
    template:
      "**As a** {role} user, **I want** to edit an existing {module} record, **so that** its data stays accurate.",
  },
  {
    testType: "crud",
    match: (t) => /ลบ|delete|remove/.test(t),
    template:
      "**As a** {role} user, **I want** to delete a {module} record, **so that** the list reflects only valid entries.",
  },
  {
    testType: "crud",
    match: () => true,
    template:
      "**As a** {role} user, **I want** to manage {module} records via CRUD, **so that** the data stays correct over time.",
  },
  {
    testType: "security",
    match: (t) => /xss|<script>/.test(t),
    template:
      "**As the** system, **I want** XSS payloads in {module} inputs to be neutralized, **so that** no script executes in users' browsers.",
  },
  {
    testType: "security",
    match: (t) => /sql/.test(t),
    template:
      "**As the** system, **I want** SQL-injection payloads in {module} fields to be safely handled, **so that** the database remains intact.",
  },
  {
    testType: "security",
    match: (t) => /maxlength|ยาว|long|rate|429/.test(t),
    template:
      "**As the** system, **I want** abusive {module} inputs/requests bounded, **so that** safety and stability are preserved.",
  },
  {
    testType: "security",
    match: () => true,
    template:
      "**As the** system, **I want** {module} inputs hardened against common attacks, **so that** the application stays safe.",
  },
  {
    testType: "authorization",
    match: () => true,
    template:
      "**As a** low-privilege user, **I should NOT** see Add/edit controls on {module}, **so that** role separation is enforced.",
  },
  {
    testType: "auth-guard",
    match: () => true,
    template:
      "**As an** unauthenticated user hitting a protected route, **I want** to be redirected to /login, **so that** protected screens stay protected.",
  },
];

const GENERIC_FALLBACK =
  "**As a** {role} user, **I want** this {module} behavior verified, **so that** the feature works as expected.";

function deriveNarrative(
  testType: string,
  title: string,
  role: string,
  moduleName: string,
): { line: string; isFallback: boolean } {
  const tt = (testType || "").toLowerCase();
  const titleLower = title.toLowerCase();
  for (const r of RULES) {
    if (r.testType !== tt) continue;
    if (!r.match(titleLower)) continue;
    return {
      line: r.template.replaceAll("{role}", role).replaceAll("{module}", moduleName),
      isFallback: false,
    };
  }
  return {
    line: GENERIC_FALLBACK.replaceAll("{role}", role).replaceAll("{module}", moduleName),
    isFallback: true,
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Per-spec processing
 * ─────────────────────────────────────────────────────────────────────── */

function processSpec(filePath: string): {
  specBase: string;
  rows: TCRow[];
  role: string;
  moduleName: string;
} {
  const code = readFileSync(filePath, "utf8");
  const src = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
  const consts = collectConstStrings(src);
  const role = findAuthRole(src) ?? "any authenticated";
  const specBase = basename(filePath).replace(/\.spec\.ts$/, "");
  const moduleName = moduleNameFromBasename(specBase);

  const direct = extractTestCalls(src);
  const rows: TCRow[] = direct.map((d) => ({
    testId: d.testId,
    title: d.title,
    skipped: d.skipped,
    ann: { ...EMPTY_ANN, ...d.ann },
  }));

  const securityCalls = findSecurityHelperCalls(src, consts);
  for (const call of securityCalls) {
    rows.push(...synthesizeSecurityRows(call));
  }

  // Dedup by testId (direct rows win over synthesized).
  const seen = new Map<string, TCRow>();
  for (const r of rows) {
    if (!seen.has(r.testId)) seen.set(r.testId, r);
  }
  const deduped = Array.from(seen.values());
  deduped.sort((a, b) => a.testId.localeCompare(b.testId));

  return { specBase, rows: deduped, role, moduleName };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Markdown rendering
 * ─────────────────────────────────────────────────────────────────────── */

function escapeTableCell(s: string): string {
  return s.replaceAll("|", "\\|");
}

function renderSteps(steps: string): string {
  if (!steps.trim()) return "_(no steps documented)_";
  return steps;
}

function renderRow(row: TCRow, role: string, moduleName: string): string {
  const { ann } = row;
  const roleHint = (() => {
    const m = row.title.match(/\b(Requestor|HOD|Purchase|FC|GM|Owner|TT)\b/);
    return m ? m[1] : role;
  })();
  const { line, isFallback } = deriveNarrative(
    ann.testType,
    row.title,
    roleHint,
    moduleName,
  );

  const skippedTag = row.skipped ? " _(skipped)_" : "";
  const titleClean = row.title.replace(/^\S+\s+/, "");
  const lines: string[] = [];
  lines.push(`## ${row.testId} — ${titleClean}${skippedTag}`);
  lines.push("");
  lines.push(`> ${line}`);
  if (isFallback) lines.push("<!-- TODO: refine narrative -->");
  lines.push("");
  lines.push(
    `**Priority:** ${ann.priority || "_unset_"} · **Test Type:** ${ann.testType || "_unset_"}`,
  );
  lines.push("");
  lines.push("**Preconditions**");
  lines.push("");
  lines.push(ann.preconditions || "_(none documented)_");
  lines.push("");
  lines.push("**Steps**");
  lines.push("");
  lines.push(renderSteps(ann.steps));
  lines.push("");
  lines.push("**Expected**");
  lines.push("");
  lines.push(ann.expected || "_(no expected outcome documented)_");
  if (ann.note) {
    lines.push("");
    lines.push(`> _Note: ${ann.note.replaceAll("\n", " ")}_`);
  }
  lines.push("");
  lines.push("---");
  return lines.join("\n");
}

function gitSha(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

function renderSpecMarkdown(
  specBase: string,
  rows: TCRow[],
  role: string,
  moduleName: string,
): string {
  const counts = { High: 0, Medium: 0, Low: 0, other: 0 };
  for (const r of rows) {
    const p = r.ann.priority;
    if (p === "High" || p === "Medium" || p === "Low") counts[p] += 1;
    else counts.other += 1;
  }

  const out: string[] = [];
  out.push(`# ${moduleName} — User Stories`);
  out.push("");
  out.push(
    `_Generated from \`tests/${specBase}.spec.ts\` annotations. Edit annotations, not this file. Regenerate with \`bun docs:user-stories\`._`,
  );
  out.push("");
  out.push(`**Module:** ${moduleName}`);
  out.push(`**Spec:** \`tests/${specBase}.spec.ts\``);
  out.push(`**Default role:** ${role}`);
  out.push(
    `**Total test cases:** ${rows.length} (${counts.High} High / ${counts.Medium} Medium / ${counts.Low} Low${counts.other ? ` / ${counts.other} unset` : ""})`,
  );
  out.push("");
  out.push("## Test Cases at a Glance");
  out.push("");
  out.push("| TC | Title | Priority | Test Type |");
  out.push("| --- | --- | --- | --- |");
  for (const r of rows) {
    const titleClean = r.title.replace(/^\S+\s+/, "");
    out.push(
      `| ${r.testId}${r.skipped ? " _(skipped)_" : ""} | ${escapeTableCell(titleClean)} | ${r.ann.priority || "—"} | ${r.ann.testType || "—"} |`,
    );
  }
  out.push("");
  out.push("---");
  out.push("");
  for (const r of rows) {
    out.push(renderRow(r, role, moduleName));
    out.push("");
  }
  out.push("");
  out.push(
    `<sub>Last regenerated: ${new Date().toISOString().slice(0, 10)} · git ${gitSha()}</sub>`,
  );
  out.push("");
  return out.join("\n");
}

/* ─────────────────────────────────────────────────────────────────────────
 * Entry point
 * ─────────────────────────────────────────────────────────────────────── */

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const specs = readdirSync(TESTS_DIR)
    .filter((f) => f.endsWith(".spec.ts"))
    .sort();

  let total = 0;
  for (const spec of specs) {
    const filePath = join(TESTS_DIR, spec);
    const { specBase, rows, role, moduleName } = processSpec(filePath);
    const md = renderSpecMarkdown(specBase, rows, role, moduleName);
    const outPath = join(OUT_DIR, `${specBase}.md`);
    writeFileSync(outPath, md, "utf8");
    total += rows.length;
    // eslint-disable-next-line no-console
    console.log(`[user-stories] ${specBase}: ${rows.length} TCs → ${outPath}`);
  }
  // eslint-disable-next-line no-console
  console.log(
    `[user-stories] Wrote ${specs.length} files / ${total} test cases → ${OUT_DIR}`,
  );
}

main();
