/**
 * Creates the ADMIN_PASSPHRASE_HASH value for the local administration utility (ADR-056).
 *
 *   npm run admin:passphrase            # asks twice, input hidden
 *   printf '%s\n' "…" | npm run admin:passphrase --silent   # non-interactive (e.g. provisioning)
 *
 * The passphrase is read from the terminal (never from command-line arguments, which end up in shell
 * history) and only its scrypt hash is printed. Paste the printed line into .env; never store the
 * passphrase itself. Choose at least 12 characters — four or more unrelated words work well.
 */
import { createInterface } from "node:readline";
import { hashPassphrase, MIN_PASSPHRASE_LENGTH } from "../src/server/admin/passphrase";

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  if (process.stdin.isTTY) {
    // Hide what is typed.
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (s.includes(question)) process.stdout.write(question);
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      if (process.stdin.isTTY) process.stdout.write("\n");
      resolve(answer);
    }),
  );
}

async function readPiped(): Promise<string> {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data.split(/\r?\n/)[0] ?? "";
}

async function main() {
  let passphrase: string;
  if (process.stdin.isTTY) {
    passphrase = await ask(`Frase de acceso (mínimo ${MIN_PASSPHRASE_LENGTH} caracteres): `);
    const again = await ask("Repita la frase de acceso: ");
    if (again !== passphrase) {
      console.error("Las frases no coinciden.");
      process.exit(2);
    }
  } else {
    passphrase = await readPiped();
  }
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    console.error(`La frase debe tener al menos ${MIN_PASSPHRASE_LENGTH} caracteres.`);
    process.exit(2);
  }
  const hash = await hashPassphrase(passphrase);
  if (process.stdin.isTTY) console.log("\nCopie esta línea en .env (y ADMIN_ENABLED=true):\n");
  console.log(`ADMIN_PASSPHRASE_HASH=${hash}`);
}

main().catch(() => {
  console.error("No se pudo generar el hash.");
  process.exit(1);
});
