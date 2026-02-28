from PyInstaller.utils.hooks import collect_data_files

datas = [
    *collect_data_files('pgserver'),
    ('alembic/', 'alembic/'),
    ('alembic.ini', '.'),
]

a = Analysis(
    ['main.py'],
    datas=datas,
    hiddenimports=['pgserver', 'platformdirs'],
)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, name='hotprevue', console=False)
coll = COLLECT(exe, a.binaries, a.datas, name='hotprevue')
