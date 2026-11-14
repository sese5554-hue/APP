import { networkInterfaces } from "node:os";
import { isIP } from "node:net";
import { pathToFileURL } from "node:url";
import path from "node:path";
export function isPrivateIPv4(address) {
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  return (
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  );
}
export function chooseLanAddress(interfaces, preferred) {
  const candidates = Object.entries(interfaces).flatMap(([name, entries]) =>
    (entries || [])
      .filter(
        (entry) =>
          entry.family === "IPv4" &&
          !entry.internal &&
          isPrivateIPv4(entry.address),
      )
      .map((entry) => ({ name, address: entry.address })),
  );
  if (preferred) {
    const match = candidates.find((item) => item.address === preferred);
    if (!match)
      throw new Error(
        "--lan-ip must be a private IPv4 address assigned to this PC.",
      );
    return match.address;
  }
  const physical = candidates.filter(
    (item) =>
      !/virtual|vethernet|vmware|virtualbox|docker|wsl|vpn|tailscale|zerotier|hyper-v/i.test(
        item.name,
      ),
  );
  const selected = (physical.length ? physical : candidates).sort(
    (a, b) =>
      Number(!/wi-?fi|wireless|ethernet|이더넷|무선/i.test(a.name)) -
      Number(!/wi-?fi|wireless|ethernet|이더넷|무선/i.test(b.name)),
  )[0];
  if (!selected)
    throw new Error(
      "No private LAN IPv4 address found. Connect this PC and phone to the same router/Wi-Fi.",
    );
  return selected.address;
}
export function mobileAddress(preferred) {
  return chooseLanAddress(networkInterfaces(), preferred);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  console.log(mobileAddress());
