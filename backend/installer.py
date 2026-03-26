"""
Hotprevue installer — Tkinter setup wizard.

Kalles fra install.bat i rotkatalogen:
    cd /d "%~dp0backend"
    "%~dp0uv.exe" run --python 3.12 python installer.py --root "%~dp0"

Steg 1   — Velg datakatalog (portabel / brukerprofil / egendefinert).
Steg 1b  — Sikkerhetskopi (kun hvis eksisterende database oppdages).
Steg 2   — Maskinnavn + første fotograf (kun ved ny database).
Steg 3   — Ferdig. Genererer hotprevue.bat i rotkatalogen.
"""

import argparse
import datetime
import os
import subprocess
import uuid
import zipfile
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox

# ── Konstanter ────────────────────────────────────────────────────────────────
WIN_W, WIN_H = 540, 400
PAD = 18
FONT_TITLE  = ("Segoe UI", 13, "bold")
FONT_BODY   = ("Segoe UI", 10)
FONT_SMALL  = ("Segoe UI", 9)
HEADER_BG   = "#1e3a5f"
HEADER_FG   = "white"
HEADER_STEP = "#93c5fd"
COLOR_WARN  = "#92400e"
COLOR_HINT  = "#6b7280"
COLOR_LINK  = "#1d4ed8"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--root", required=True,
                   help="Rotkatalog for Hotprevue-installasjonen")
    return p.parse_args()


# ── Hoved-app ─────────────────────────────────────────────────────────────────
class InstallerApp(tk.Tk):
    def __init__(self, root_dir: Path) -> None:
        super().__init__()
        self.root_dir = root_dir

        self.title("Hotprevue — Installasjon")
        self.resizable(False, False)
        self.geometry(f"{WIN_W}x{WIN_H}")

        # Wizard-tilstand
        self.data_mode        = tk.StringVar(value="appdata")
        self.custom_path      = tk.StringVar()
        self.machine_name     = tk.StringVar()
        self.photographer     = tk.StringVar()
        self.resolved_data_dir: Path | None = None
        self.is_new_database  = False
        self._generated_bat:  Path | None = None
        self._progress_label: tk.Label | None = None

        self._show_step1()

    # ── Hjelpere ──────────────────────────────────────────────────────────────
    def _clear(self) -> None:
        for w in self.winfo_children():
            w.destroy()

    def _header(self, step: int, title: str) -> None:
        bar = tk.Frame(self, bg=HEADER_BG, height=58)
        bar.pack(fill="x")
        bar.pack_propagate(False)
        tk.Label(bar, text=title, font=FONT_TITLE,
                 fg=HEADER_FG, bg=HEADER_BG).pack(side="left", padx=PAD)
        step_text = f"Steg {step} av 2" if step <= 2 else ""
        tk.Label(bar, text=step_text, font=FONT_SMALL,
                 fg=HEADER_STEP, bg=HEADER_BG).pack(side="right", padx=PAD)

    def _body(self) -> tk.Frame:
        f = tk.Frame(self, padx=PAD, pady=PAD)
        f.pack(fill="both", expand=True)
        return f

    def _bottom(self) -> tk.Frame:
        f = tk.Frame(self, padx=PAD, pady=12)
        f.pack(side="bottom", fill="x")
        return f

    def _spacer(self, parent: tk.Widget, h: int = 10) -> None:
        tk.Frame(parent, height=h).pack()

    # ── Steg 1: Datakatalog ───────────────────────────────────────────────────
    def _show_step1(self) -> None:
        self._clear()
        self._header(1, "Velg datakatalog")
        body = self._body()

        tk.Label(body,
                 text="Hotprevue lagrer database og forhåndsvisninger i en datakatalog.",
                 font=FONT_BODY).pack(anchor="w")
        self._spacer(body, 14)

        # Portabel
        portable_path = self.root_dir / "data"
        tk.Radiobutton(body,
                       text=f"Portabel — lagres i programkatalogen",
                       variable=self.data_mode, value="portable",
                       font=FONT_BODY, command=self._update_warning).pack(anchor="w")
        tk.Label(body, text=f"    {portable_path}",
                 font=FONT_SMALL, fg=COLOR_HINT).pack(anchor="w")
        tk.Label(body,
                 text="    Anbefalt hvis programmet ligger på ekstern disk.",
                 font=FONT_SMALL, fg=COLOR_HINT).pack(anchor="w")
        self._spacer(body, 8)

        # Brukerprofil
        appdata_path = self._appdata_path()
        tk.Radiobutton(body,
                       text="Brukerprofil — lagres i brukerens AppData",
                       variable=self.data_mode, value="appdata",
                       font=FONT_BODY, command=self._update_warning).pack(anchor="w")
        tk.Label(body, text=f"    {appdata_path}",
                 font=FONT_SMALL, fg=COLOR_HINT).pack(anchor="w")
        tk.Label(body,
                 text="    Anbefalt for fast PC-installasjon.",
                 font=FONT_SMALL, fg=COLOR_HINT).pack(anchor="w")
        self._spacer(body, 8)

        # Egendefinert
        custom_row = tk.Frame(body)
        custom_row.pack(anchor="w", fill="x")
        tk.Radiobutton(custom_row, text="Egendefinert:",
                       variable=self.data_mode, value="custom",
                       font=FONT_BODY, command=self._update_warning).pack(side="left")
        tk.Entry(custom_row, textvariable=self.custom_path,
                 width=30, font=FONT_BODY).pack(side="left", padx=4)
        tk.Button(custom_row, text="Bla…",
                  command=self._browse_custom, font=FONT_BODY).pack(side="left")
        self._spacer(body, 10)

        self._warn_label = tk.Label(body, text="", font=FONT_SMALL,
                                    fg=COLOR_WARN, justify="left",
                                    wraplength=WIN_W - 2 * PAD)
        self._warn_label.pack(anchor="w")

        bottom = self._bottom()
        tk.Button(bottom, text="Neste →", command=self._step1_next,
                  font=FONT_BODY, padx=12, pady=4).pack(side="right")

        self._update_warning()

    def _appdata_path(self) -> Path:
        appdata = os.environ.get("APPDATA", "")
        if appdata:
            return Path(appdata) / "Hotprevue"
        return Path.home() / "AppData" / "Roaming" / "Hotprevue"

    def _browse_custom(self) -> None:
        path = filedialog.askdirectory(title="Velg datakatalog")
        if path:
            self.custom_path.set(path)
            self.data_mode.set("custom")
            self._update_warning()

    def _get_data_dir(self) -> Path | None:
        mode = self.data_mode.get()
        if mode == "portable":
            return self.root_dir / "data"
        if mode == "appdata":
            return self._appdata_path()
        raw = self.custom_path.get().strip()
        return Path(raw) if raw else None

    def _update_warning(self) -> None:
        data_dir = self._get_data_dir()
        warnings: list[str] = []

        if data_dir:
            try:
                prog_drive = self.root_dir.drive.upper()
                data_drive = data_dir.drive.upper()
                if prog_drive and data_drive and prog_drive != data_drive:
                    mode = self.data_mode.get()
                    if mode == "appdata":
                        warnings.append(
                            f"⚠  Programmet er på ekstern disk ({prog_drive}), men databasen "
                            f"lagres på {data_drive}. Hvis du tar disken til en annen PC, "
                            "vil ikke databasen følge med. Vurder portabel modus."
                        )
                    else:
                        warnings.append(
                            f"⚠  Programmet ({prog_drive}) og databasen ({data_drive}) ligger "
                            "på forskjellige disker. Dette fungerer, men er ikke offisielt "
                            "støttet i denne versjonen."
                        )
            except (AttributeError, TypeError):
                pass

        if self._warn_label:
            self._warn_label.config(text="\n".join(warnings))

    def _has_existing_database(self, data_dir: Path) -> bool:
        pgdata = data_dir / "pgdata"
        try:
            return pgdata.exists() and any(pgdata.iterdir())
        except (PermissionError, OSError):
            return False

    def _step1_next(self) -> None:
        data_dir = self._get_data_dir()
        if not data_dir:
            messagebox.showerror("Mangler sti", "Velg eller skriv inn en datakatalog.")
            return

        self.resolved_data_dir = data_dir

        if self._has_existing_database(data_dir):
            self.is_new_database = False
            self._show_backup_step()
        else:
            self.is_new_database = True
            self._show_step2()

    # ── Steg 1b: Sikkerhetskopi ───────────────────────────────────────────────
    def _show_backup_step(self) -> None:
        self._clear()
        self._header(1, "Sikkerhetskopi anbefales")
        body = self._body()

        tk.Label(body,
                 text="Vi fant en eksisterende database på valgt sted.",
                 font=FONT_BODY).pack(anchor="w")
        self._spacer(body, 8)
        tk.Label(body,
                 text="Før du fortsetter anbefaler vi å ta en sikkerhetskopi.\n"
                      "Backupen er en zip-fil med hele databasen og forhåndsvisningene.\n"
                      "Du velger selv hvor filen lagres.",
                 font=FONT_BODY, justify="left").pack(anchor="w")
        self._spacer(body, 16)

        self._backup_status = tk.Label(body, text="", font=FONT_SMALL,
                                       fg=COLOR_HINT, justify="left",
                                       wraplength=WIN_W - 2 * PAD)
        self._backup_status.pack(anchor="w")

        bottom = self._bottom()
        tk.Button(bottom, text="← Tilbake", command=self._show_step1,
                  font=FONT_BODY, padx=8).pack(side="left")
        tk.Button(bottom, text="Fortsett uten backup →",
                  command=self._after_backup,
                  font=FONT_BODY, padx=8).pack(side="right", padx=(0, 8))
        tk.Button(bottom, text="Ta sikkerhetskopi…",
                  command=self._do_backup,
                  font=FONT_BODY, padx=12, pady=4).pack(side="right")

    def _do_backup(self) -> None:
        data_dir = self.resolved_data_dir
        assert data_dir is not None

        timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        default_name = f"hotprevue-backup-{timestamp}.zip"

        dest = filedialog.asksaveasfilename(
            title="Lagre sikkerhetskopi",
            defaultextension=".zip",
            filetypes=[("Zip-fil", "*.zip"), ("Alle filer", "*.*")],
            initialfile=default_name,
        )
        if not dest:
            return

        self._backup_status.config(text="Lager backup…", fg=COLOR_HINT)
        self.update()

        try:
            sources = [
                ("pgdata",       data_dir / "pgdata"),
                ("coldpreviews", data_dir / "coldpreviews"),
            ]
            with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as zf:
                for folder_name, folder_path in sources:
                    if not folder_path.exists():
                        continue
                    for file in folder_path.rglob("*"):
                        if file.is_file():
                            zf.write(file, folder_name / file.relative_to(folder_path))

            size_mb = round(Path(dest).stat().st_size / 1_048_576, 1)
            self._backup_status.config(
                text=f"✓  Backup lagret ({size_mb} MB):\n   {dest}",
                fg=COLOR_HINT,
            )
        except Exception as exc:
            messagebox.showerror("Backup feilet", str(exc))
            self._backup_status.config(text="Backup mislyktes.", fg=COLOR_WARN)

    def _after_backup(self) -> None:
        self._generate_bat()
        self._show_done()

    # ── Steg 2: Maskinnavn + fotograf ─────────────────────────────────────────
    def _show_step2(self) -> None:
        self._clear()
        self._header(2, "Sett opp maskinen")
        body = self._body()

        tk.Label(body,
                 text="Ingen eksisterende database ble funnet på valgt sted.\n"
                      "Gi maskinen et navn og opprett din første fotograf.",
                 font=FONT_BODY, justify="left").pack(anchor="w")
        self._spacer(body, 16)

        tk.Label(body, text="Maskinnavn:", font=FONT_BODY).pack(anchor="w")
        tk.Entry(body, textvariable=self.machine_name,
                 font=FONT_BODY, width=36).pack(anchor="w", pady=(2, 2))
        tk.Label(body, text="F.eks. «Stue-PC» eller «Bærbar»",
                 font=FONT_SMALL, fg=COLOR_HINT).pack(anchor="w")
        self._spacer(body, 14)

        tk.Label(body, text="Ditt navn (første fotograf):", font=FONT_BODY).pack(anchor="w")
        tk.Entry(body, textvariable=self.photographer,
                 font=FONT_BODY, width=36).pack(anchor="w", pady=(2, 2))

        bottom = self._bottom()
        tk.Button(bottom, text="← Tilbake", command=self._show_step1,
                  font=FONT_BODY, padx=8).pack(side="left")
        tk.Button(bottom, text="Installer →", command=self._step2_next,
                  font=FONT_BODY, padx=12, pady=4).pack(side="right")

    def _step2_next(self) -> None:
        if not self.machine_name.get().strip():
            messagebox.showerror("Mangler maskinnavn", "Skriv inn et navn for denne maskinen.")
            return
        if not self.photographer.get().strip():
            messagebox.showerror("Mangler fotografnavn", "Skriv inn ditt navn som fotograf.")
            return
        self._run_full_setup()

    # ── Oppsett (ny database) ─────────────────────────────────────────────────
    def _run_full_setup(self) -> None:
        self._clear()
        self._header(3, "Setter opp Hotprevue…")
        body = self._body()
        self._progress_label = tk.Label(body, text="", font=FONT_BODY)
        self._progress_label.pack(anchor="w", pady=8)
        self.update()

        try:
            self._do_full_setup()
        except Exception as exc:
            messagebox.showerror("Feil under installasjon",
                                 f"Noe gikk galt:\n\n{exc}\n\n"
                                 "Sjekk at du har skrivetilgang til valgt katalog.")
            self._show_step1()
            return

        self._show_done()

    def _set_progress(self, msg: str) -> None:
        if self._progress_label:
            self._progress_label.config(text=msg)
        self.update()

    def _do_full_setup(self) -> None:
        data_dir = self.resolved_data_dir
        assert data_dir is not None

        os.environ["DATA_DIR"] = str(data_dir)
        os.environ["HOTPREVUE_SERVER"] = "local"

        self._set_progress("Starter database…")
        from core.local_setup import setup_local_environment
        setup_local_environment()

        self._set_progress("Oppretter tabeller…")
        from alembic.config import Config
        from alembic import command as alembic_command
        cfg = Config("alembic.ini")
        alembic_command.upgrade(cfg, "head")

        self._set_progress("Oppretter innstillinger…")
        from database.session import SessionLocal
        import models.settings  # noqa: F401 — ensure model is registered
        from models.settings import SystemSettings
        with SessionLocal() as db:
            if db.query(SystemSettings).first() is None:
                db.add(SystemSettings(installation_id=uuid.uuid4()))
                db.commit()

        self._set_progress("Registrerer maskin…")
        from core.data_dir import DataDir
        from models.machine import Machine
        dd = DataDir(data_dir)
        machine_id = dd.machine_id()
        with SessionLocal() as db:
            db.add(Machine(
                machine_id=machine_id,
                machine_name=self.machine_name.get().strip(),
                settings={},
            ))
            db.commit()

        self._set_progress("Oppretter fotograf…")
        from models.photographer import Photographer
        with SessionLocal() as db:
            db.add(Photographer(
                name=self.photographer.get().strip(),
                is_default=True,
            ))
            db.commit()

        self._set_progress("Setter opp snarveier…")
        from services.shortcut_service import seed_default
        with SessionLocal() as db:
            seed_default(db, machine_id, str(Path.home()))

        self._set_progress("Genererer oppstartsfil…")
        self._generate_bat()

    # ── Generer hotprevue.bat ─────────────────────────────────────────────────
    def _generate_bat(self) -> None:
        mode = self.data_mode.get()

        if mode == "portable":
            data_dir_line = "set DATA_DIR=%~dp0data"
        elif mode == "appdata":
            data_dir_line = "set DATA_DIR=%APPDATA%\\Hotprevue"
        else:
            data_dir_line = f"set DATA_DIR={self.resolved_data_dir}"

        content = (
            "@echo off\r\n"
            "setlocal\r\n"
            "\r\n"
            "set HOTPREVUE_SERVER=local\r\n"
            "set HOTPREVUE_OPEN_BROWSER=true\r\n"
            f"{data_dir_line}\r\n"
            "\r\n"
            'cd /d "%~dp0backend"\r\n'
            '"%~dp0uv.exe" run --python 3.12 uvicorn main:app --host 127.0.0.1 --port 8000\r\n'
            "\r\n"
            "endlocal\r\n"
        )

        bat_path = self.root_dir / "hotprevue.bat"
        bat_path.write_text(content, encoding="utf-8")
        self._generated_bat = bat_path

    # ── Steg 3: Ferdig ────────────────────────────────────────────────────────
    def _show_done(self) -> None:
        self._clear()
        self._header(3, "Ferdig!")
        body = self._body()

        if self.is_new_database:
            msg = "Hotprevue er installert og klar til bruk."
        else:
            msg = "Tilkobling til eksisterende database er konfigurert."

        tk.Label(body, text=msg, font=FONT_BODY).pack(anchor="w")
        self._spacer(body, 12)

        tk.Label(body, text="Oppstartsfil opprettet:", font=FONT_SMALL,
                 fg=COLOR_HINT).pack(anchor="w")
        tk.Label(body, text=str(self._generated_bat), font=FONT_BODY,
                 fg=COLOR_LINK).pack(anchor="w")
        self._spacer(body, 10)

        tk.Label(body,
                 text="Fremover: Dobbeltklikk på hotprevue.bat for å starte Hotprevue.",
                 font=FONT_SMALL, fg=COLOR_HINT).pack(anchor="w")

        bottom = self._bottom()
        tk.Button(bottom, text="Start Hotprevue nå",
                  command=self._launch_and_exit,
                  font=FONT_BODY, padx=12, pady=4).pack(side="right")
        tk.Button(bottom, text="Avslutt",
                  command=self.destroy,
                  font=FONT_BODY, padx=8).pack(side="right", padx=(0, 8))

    def _launch_and_exit(self) -> None:
        # Stopp pgserver eksplisitt slik at hotprevue.bat kan starte sin egen instans
        import builtins
        pg = getattr(builtins, "_pg_server", None)
        if pg is not None:
            try:
                pg.cleanup()
            except Exception:
                pass

        bat = self._generated_bat
        if bat and bat.exists():
            subprocess.Popen(
                [str(bat)],
                shell=True,
                cwd=str(self.root_dir),
                creationflags=getattr(subprocess, "CREATE_NEW_CONSOLE", 0),
            )
        self.destroy()


# ── Inngang ───────────────────────────────────────────────────────────────────
def main() -> None:
    args = parse_args()
    root_dir = Path(args.root).resolve()
    app = InstallerApp(root_dir)
    app.mainloop()


if __name__ == "__main__":
    main()
