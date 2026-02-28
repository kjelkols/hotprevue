import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from models.machine import Machine
from models.settings import SystemSettings
from schemas.settings import (
    GlobalSettingsOut,
    GlobalSettingsPatch,
    MachineSettingsOut,
    MachineSettingsPatch,
    SettingsOut,
)

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_machine(db: Session) -> Machine:
    machine_id_str = os.environ.get("HOTPREVUE_MACHINE_ID")
    if not machine_id_str:
        raise HTTPException(status_code=500, detail="HOTPREVUE_MACHINE_ID not set")
    machine_id = uuid.UUID(machine_id_str)
    machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
    if machine is None:
        raise HTTPException(status_code=500, detail="Machine record not found")
    return machine


def _machine_to_out(machine: Machine) -> MachineSettingsOut:
    return MachineSettingsOut(
        machine_id=machine.machine_id,
        machine_name=machine.machine_name,
        default_photographer_id=machine.settings.get("default_photographer_id"),
    )


@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    global_settings = db.query(SystemSettings).first()
    if global_settings is None:
        raise HTTPException(status_code=500, detail="SystemSettings not initialized")
    machine = _get_machine(db)
    return SettingsOut(
        global_=GlobalSettingsOut.model_validate(global_settings),
        machine=_machine_to_out(machine),
    )


@router.patch("/global", response_model=GlobalSettingsOut)
def patch_global_settings(body: GlobalSettingsPatch, db: Session = Depends(get_db)):
    global_settings = db.query(SystemSettings).first()
    if global_settings is None:
        raise HTTPException(status_code=500, detail="SystemSettings not initialized")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(global_settings, field, value)
    db.commit()
    db.refresh(global_settings)
    return GlobalSettingsOut.model_validate(global_settings)


@router.patch("/machine", response_model=MachineSettingsOut)
def patch_machine_settings(body: MachineSettingsPatch, db: Session = Depends(get_db)):
    machine = _get_machine(db)
    if body.machine_name is not None:
        machine.machine_name = body.machine_name
    if "default_photographer_id" in body.model_fields_set:
        settings = dict(machine.settings)
        if body.default_photographer_id is not None:
            settings["default_photographer_id"] = str(body.default_photographer_id)
        else:
            settings.pop("default_photographer_id", None)
        machine.settings = settings
    db.commit()
    db.refresh(machine)
    return _machine_to_out(machine)
