"""Inspeciona a central de adoção no ReDroid com a sessão de QA já autenticada."""

import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path


DEVICE = "127.0.0.1:5555"
OUTPUT = Path(".artifacts/redroid")
OUTPUT.mkdir(parents=True, exist_ok=True)


def adb(*args: str) -> str:
    result = subprocess.run(
        ["adb", "-s", DEVICE, *args], check=True, capture_output=True, text=True
    )
    return result.stdout


def dump(name: str) -> ET.Element:
    adb("shell", "uiautomator", "dump", "/sdcard/window.xml")
    raw = adb("shell", "cat", "/sdcard/window.xml")
    xml = raw[raw.find("<?xml") :]
    (OUTPUT / f"{name}.xml").write_text(xml, encoding="utf-8")
    with (OUTPUT / f"{name}.png").open("wb") as image:
        subprocess.run(["adb", "-s", DEVICE, "exec-out", "screencap", "-p"], check=True, stdout=image)
    return ET.fromstring(xml)


def node_for(root: ET.Element, label: str) -> ET.Element | None:
    accessible = next(
        (node for node in root.iter("node") if label in node.attrib.get("content-desc", "")),
        None,
    )
    if accessible is not None:
        return accessible
    return next(
        (node for node in root.iter("node") if label in node.attrib.get("text", "")),
        None,
    )


def tap(root: ET.Element, label: str) -> None:
    node = node_for(root, label)
    if node is None:
        raise AssertionError(f"Controle de navegação indisponível: {label}")
    bounds = [int(value) for value in re.findall(r"\d+", node.attrib["bounds"])]
    adb("shell", "input", "tap", str((bounds[0] + bounds[2]) // 2), str((bounds[1] + bounds[3]) // 2))


def wait_for(label: str, name: str) -> ET.Element:
    for _ in range(12):
        time.sleep(1)
        root = dump(name)
        if node_for(root, label) is not None:
            return root
    raise AssertionError(f"Conteúdo esperado não apareceu: {label}")


home = dump("owner-home")
tap(home, "Mais opções")
more = wait_for("Missões e conquistas", "owner-more")
tap(more, "Missões e conquistas")
missions = wait_for("Encontre seu próximo passo", "owner-missions")
if node_for(missions, "Não foi possível carregar suas missões") is not None:
    raise AssertionError("A consulta de missões falhou no perfil assinante")
tap(missions, "Conquistas")
achievements = wait_for("Assessoria identificada", "owner-achievements")
if node_for(achievements, "Não foi possível carregar suas missões") is not None:
    raise AssertionError("A coleção de conquistas falhou no perfil assinante")
print("Sessão assinante: missões e coleção de conquistas visíveis no ReDroid.")
