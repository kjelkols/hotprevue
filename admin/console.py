"""Hotprevue Admin — lokal administrasjonskonsoll"""
from __future__ import annotations

import sys
import tkinter as tk
import webbrowser
from pathlib import Path
from tkinter import filedialog, messagebox, scrolledtext, ttk

sys.path.insert(0, str(Path(__file__).parent))
import backup as bkp_module
import config as cfg_module
import server as srv_module


class App(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Hotprevue Admin")
        self.resizable(True, True)
        self.minsize(520, 560)
        self._cfg = cfg_module.load()
        self._server = srv_module.ServerManager()
        self._build_ui()
        self._poll_log()

    # ── UI ──────────────────────────────────────────────────────────────────

    def _build_ui(self) -> None:
        pad = {"padx": 10, "pady": 4}

        # Status-rad
        status_frame = ttk.Frame(self)
        status_frame.pack(fill="x", **pad)
        self._status_dot = tk.Label(status_frame, text="●", font=("", 14), fg="red")
        self._status_dot.pack(side="left")
        self._status_label = ttk.Label(status_frame, text="Server er stoppet")
        self._status_label.pack(side="left", padx=6)

        # Knapper
        btn_frame = ttk.Frame(self)
        btn_frame.pack(fill="x", **pad)
        self._btn_start = ttk.Button(btn_frame, text="Start", command=self._on_start)
        self._btn_start.pack(side="left", padx=(0, 4))
        self._btn_stop = ttk.Button(btn_frame, text="Stopp", command=self._on_stop, state="disabled")
        self._btn_stop.pack(side="left", padx=(0, 4))
        self._btn_open = ttk.Button(btn_frame, text="Åpne i nettleser", command=self._on_open, state="disabled")
        self._btn_open.pack(side="left")

        # Innstillinger
        sf = ttk.LabelFrame(self, text="Innstillinger")
        sf.pack(fill="x", **pad)

        ttk.Label(sf, text="Port:").grid(row=0, column=0, sticky="w", padx=6, pady=3)
        self._port_var = tk.StringVar(value=str(self._cfg.port))
        ttk.Entry(sf, textvariable=self._port_var, width=8).grid(row=0, column=1, sticky="w", padx=6)

        ttk.Label(sf, text="Datakatalog:").grid(row=1, column=0, sticky="w", padx=6, pady=3)
        self._data_dir_var = tk.StringVar(value=self._cfg.data_dir)
        ttk.Entry(sf, textvariable=self._data_dir_var, width=38).grid(row=1, column=1, sticky="we", padx=6)
        ttk.Button(sf, text="Velg…", command=self._pick_data_dir).grid(row=1, column=2, padx=4)

        self._open_browser_var = tk.BooleanVar(value=self._cfg.open_browser)
        ttk.Checkbutton(sf, text="Åpne nettleser ved start", variable=self._open_browser_var).grid(
            row=2, column=0, columnspan=3, sticky="w", padx=6, pady=3
        )
        ttk.Button(sf, text="Lagre innstillinger", command=self._save_settings).grid(
            row=3, column=0, columnspan=3, sticky="w", padx=6, pady=(0, 6)
        )
        sf.columnconfigure(1, weight=1)

        # Vedlikehold
        mf = ttk.LabelFrame(self, text="Vedlikehold")
        mf.pack(fill="x", **pad)
        ttk.Button(mf, text="Ta sikkerhetskopi…", command=self._on_backup).pack(
            side="left", padx=6, pady=6
        )

        # Logg
        lf = ttk.LabelFrame(self, text="Logg")
        lf.pack(fill="both", expand=True, **pad)
        self._log = scrolledtext.ScrolledText(
            lf, height=12, state="disabled", wrap="word", font=("Consolas", 9)
        )
        self._log.pack(fill="both", expand=True, padx=4, pady=4)

    # ── Handlinger ───────────────────────────────────────────────────────────

    def _on_start(self) -> None:
        self._save_settings(quiet=True)
        self._server.start(
            port=self._cfg.port,
            data_dir=self._cfg.data_dir,
            open_browser=self._cfg.open_browser,
        )
        self._update_status()

    def _on_stop(self) -> None:
        self._server.stop()
        self._update_status()

    def _on_open(self) -> None:
        webbrowser.open(f"http://127.0.0.1:{self._cfg.port}")

    def _on_backup(self) -> None:
        if not self._server.is_running():
            messagebox.showwarning("Sikkerhetskopi", "Start serveren først.")
            return
        path = filedialog.asksaveasfilename(
            defaultextension=".sql",
            filetypes=[("SQL-fil", "*.sql"), ("Alle filer", "*.*")],
            initialfile="hotprevue-backup.sql",
            title="Lagre sikkerhetskopi",
        )
        if not path:
            return
        try:
            data = bkp_module.fetch_backup(self._cfg.port)
            Path(path).write_bytes(data)
            messagebox.showinfo("Sikkerhetskopi", f"Lagret: {path}")
        except Exception as e:
            messagebox.showerror("Feil", str(e))

    def _pick_data_dir(self) -> None:
        path = filedialog.askdirectory(title="Velg datakatalog")
        if path:
            self._data_dir_var.set(path)

    def _save_settings(self, quiet: bool = False) -> None:
        try:
            port = int(self._port_var.get())
        except ValueError:
            if not quiet:
                messagebox.showerror("Feil", "Port må være et heltall.")
            return
        self._cfg.port = port
        self._cfg.data_dir = self._data_dir_var.get().strip()
        self._cfg.open_browser = self._open_browser_var.get()
        cfg_module.save(self._cfg)
        if not quiet:
            messagebox.showinfo("Innstillinger", "Lagret.")

    # ── Status og logg-polling ───────────────────────────────────────────────

    def _update_status(self) -> None:
        running = self._server.is_running()
        self._status_dot.config(fg="green" if running else "red")
        self._status_label.config(text="Server kjører" if running else "Server er stoppet")
        self._btn_start.config(state="disabled" if running else "normal")
        self._btn_stop.config(state="normal" if running else "disabled")
        self._btn_open.config(state="normal" if running else "disabled")

    def _poll_log(self) -> None:
        q = self._server.log_queue
        new_lines = False
        try:
            while True:
                line = q.get_nowait()
                self._log.config(state="normal")
                self._log.insert("end", line + "\n")
                self._log.config(state="disabled")
                new_lines = True
        except Exception:
            pass
        if new_lines:
            self._log.see("end")
            self._update_status()
        self.after(200, self._poll_log)


if __name__ == "__main__":
    App().mainloop()
