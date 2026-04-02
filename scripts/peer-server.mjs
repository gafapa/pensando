import { PeerServer } from "peer";

const port = Number(process.env.PORT || 9000);
const path = process.env.PEER_PATH || "/aulaflux";

PeerServer({
  port,
  path,
  allow_discovery: true
});

console.log(`AulaFlux PeerServer escuchando en http://0.0.0.0:${port}${path}`);
