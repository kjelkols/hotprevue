# Hotprevue AI-worker — deploy til tenketank

## Første gangs oppsett

**1. Kopier worker-koden til tenketank**
```sh
rsync -av /home/kjell/dev/hotprevue/worker/ kjell@tenketank.tail764ab5.ts.net:/opt/hotprevue/worker/
```

**2. Installer Python-pakker (på tenketank)**
```sh
source /opt/tenketank/venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cu128
pip install -r /opt/hotprevue/worker/requirements.txt
```

**3. Lag konfigurasjonsfil (på tenketank, kun én gang)**
```sh
sudo nano /etc/hotprevue-worker.env
```
Innhold:
```
HOTPREVUE_BACKEND_URL=http://beelink.tail764ab5.ts.net:8000
QDRANT_URL=http://localhost:6333
```

**4. Installer og start systemd-service (på tenketank)**
```sh
sudo cp /opt/hotprevue/worker/hotprevue-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hotprevue-worker
```

---

## Oppdatering ved ny versjon

```sh
rsync -av /home/kjell/dev/hotprevue/worker/ kjell@tenketank.tail764ab5.ts.net:/opt/hotprevue/worker/
ssh kjell@tenketank.tail764ab5.ts.net sudo systemctl restart hotprevue-worker
```

---

## Nyttige kommandoer

```sh
# Sjekk status
ssh kjell@tenketank.tail764ab5.ts.net sudo systemctl status hotprevue-worker

# Følg logg
ssh kjell@tenketank.tail764ab5.ts.net journalctl -u hotprevue-worker -f

# Stopp / start
ssh kjell@tenketank.tail764ab5.ts.net sudo systemctl stop hotprevue-worker
ssh kjell@tenketank.tail764ab5.ts.net sudo systemctl start hotprevue-worker
```
