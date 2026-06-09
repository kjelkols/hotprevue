# Hotprevue public share relay

Minimal FastAPI-app som tar imot coldpreviews fra Hotprevue og lar nginx serve
dem som statiske filer på en offentlig tilgjengelig URL.

## Oppsett på Trollfjell

```bash
# 1. Hent filer fra repoet (kjøres på dev-maskinen)
rsync -av relay/ trollfjell:/opt/hotprevue-relay/
# — eller på Trollfjell direkte:
# git clone git@github.com:kjelkols/hotprevue.git
# sudo cp hotprevue/relay/relay.py hotprevue/relay/requirements.txt /opt/hotprevue-relay/

sudo mkdir -p /opt/hotprevue-relay
cd /opt/hotprevue-relay

# 2. Virtualenv
python3 -m venv venv
venv/bin/pip install -r requirements.txt

# 3. API-nøkkel
echo "RELAY_API_KEY=generer-en-sterk-nøkkel-her" | sudo tee /opt/hotprevue-relay/.env

# 4. Lag web-katalog
sudo mkdir -p /var/www/share
sudo chown www-data:www-data /var/www/share

# 5. Systemd-tjeneste
sudo cp relay.service /etc/systemd/system/hotprevue-relay.service
sudo systemctl daemon-reload
sudo systemctl enable --now hotprevue-relay

# 6. Nginx
# Tilpass nginx.conf (domenenavn, SSL-sertifikat), kopier til /etc/nginx/sites-available/
sudo cp nginx.conf /etc/nginx/sites-available/hotprevue-share
sudo ln -s /etc/nginx/sites-available/hotprevue-share /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Innstillinger i Hotprevue

Gå til **Innstillinger → Deling** og fyll inn:

| Felt | Eksempel |
|------|---------|
| Relay-URL (API) | `https://del.eksempel.no` |
| Offentlig base-URL | `https://del.eksempel.no` |
| API-nøkkel | `<verdien fra .env>` |
| Standard levetid | `30` (dager) |

## API-kontrakt

```
POST /push/{token}?ttl_seconds=N
  Header: X-API-Key: <nøkkel>
  Body: multipart/form-data  file=<JPEG>
  → 201 { token, expires_at }

DELETE /push/{token}
  Header: X-API-Key: <nøkkel>
  → 204

GET /health
  → 200 { status: "ok", active: N }
```

Bilder er tilgjengelige på `https://del.eksempel.no/{token}.jpg`.
