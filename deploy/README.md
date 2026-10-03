# Deployment

Revealcard is built as a static site and served together with its API by the `revealcard.service` systemd user unit on `127.0.0.1:4173`. The server is bound to loopback and is exposed through Cloudflare Tunnel over HTTPS.

The deployment uses its own named Cloudflare Tunnel. The deployed hostname is `https://revealcard.kobyte01server.me`.

Create the tunnel with `cloudflared tunnel create revealcard`, then copy `cloudflared-ingress.yml` to `~/.cloudflared/revealcard.yml` and replace `REPLACE_WITH_TUNNEL_UUID` with the UUID printed by the create command. Create the DNS route with `cloudflared tunnel route dns revealcard revealcard.kobyte01server.me`.

Install and start the user services:

```sh
mkdir -p ~/.config/systemd/user
install -m 0644 deploy/revealcard.service ~/.config/systemd/user/revealcard.service
install -m 0644 deploy/revealcard-tunnel.service ~/.config/systemd/user/revealcard-tunnel.service
systemctl --user daemon-reload
systemctl --user enable --now revealcard.service revealcard-tunnel.service
```

The host needs user lingering enabled for these services to start at boot without an interactive login. The server data file is stored at `/home/kobyte01/.local/share/revealcard/revealcard.json`; keep this file backed up and outside Git.

To update the site after pulling changes, run `npm ci` when dependencies change, then run `npm run build` and restart `revealcard.service`.
