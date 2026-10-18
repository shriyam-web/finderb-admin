import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/merchantPassword";
import { validateAdminPassword, validateAdminPasswordChange } from "../src/lib/adminPasswordPolicy";

function check(name: string, condition: boolean, detail?: unknown) {
  if (!condition) {
    console.error("FAIL", name, detail ?? "");
    process.exitCode = 1;
    return;
  }
  console.log("ok", name);
}

check("rejects short", validateAdminPassword("Ab1!") !== null);
check("rejects password1", validateAdminPassword("Password1") !== null);
check("rejects digits", validateAdminPassword("12345678") !== null);
check("rejects sequence", validateAdminPassword("Abcdefg1") !== null);
check("rejects repeated", validateAdminPassword("AAAAAAAA") !== null);
check("accepts mixed", validateAdminPassword("Harbor9!Lane") === null);
check(
  "confirm mismatch",
  validateAdminPasswordChange({
    newPassword: "Harbor9!Lane",
    confirmPassword: "Harbor9!Lane!",
  }) !== null,
);
check(
  "confirm match",
  validateAdminPasswordChange({
    newPassword: "Harbor9!Lane",
    confirmPassword: "Harbor9!Lane",
  }) === null,
);

async function main() {
  const hashed = await hashPassword("Harbor9!Lane");
  check("stores scrypt", hashed.startsWith("scrypt:") && hashed.split(":").length === 3);
  const verified = await verifyPassword("Harbor9!Lane", hashed);
  check("verifies hash", verified.valid && !verified.needsRehash);
  const wrong = await verifyPassword("Harbor9!Other", hashed);
  check("rejects wrong password", !wrong.valid);
  if (process.exitCode) process.exit(process.exitCode);
  console.log("admin password policy tests passed");
}

void main();
