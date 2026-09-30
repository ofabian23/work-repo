import net from "node:net";

/**
 * Minimal plain-text SMTP server for tests: accepts one or more messages and records envelope and data.
 * It never advertises STARTTLS, so it also proves that the provider refuses to send in the clear when TLS
 * is required.
 */
export type ReceivedMail = { from: string; to: string[]; data: string };

export async function startFakeSmtp() {
  const received: ReceivedMail[] = [];
  const server = net.createServer((socket) => {
    socket.write("220 fake.test ESMTP\r\n");
    let buffer = "";
    let inData = false;
    let current: ReceivedMail = { from: "", to: [], data: "" };
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let index: number;
      while ((index = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            received.push(current);
            current = { from: "", to: [], data: "" };
            socket.write("250 2.0.0 queued as FAKE123\r\n");
          } else current.data += `${line}\n`;
          continue;
        }
        const command = line.toUpperCase();
        if (command.startsWith("EHLO")) socket.write("250-fake.test\r\n250 8BITMIME\r\n");
        else if (command.startsWith("HELO")) socket.write("250 fake.test\r\n");
        else if (command.startsWith("MAIL FROM")) {
          current.from = line.slice(10).trim();
          socket.write("250 OK\r\n");
        } else if (command.startsWith("RCPT TO")) {
          current.to.push(line.slice(8).trim());
          socket.write("250 OK\r\n");
        } else if (command === "DATA") {
          inData = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (command === "STARTTLS") {
          socket.write("502 5.5.1 STARTTLS not available\r\n");
        } else if (command === "QUIT") {
          socket.end("221 Bye\r\n");
        } else socket.write("250 OK\r\n");
      }
    });
    socket.on("error", () => undefined);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  return { port, received, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}
