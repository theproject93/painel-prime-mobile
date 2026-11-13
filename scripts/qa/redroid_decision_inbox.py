#!/usr/bin/env python3
"""Homologa a Caixa de decisões nos perfis sintéticos do ReDroid oficial."""

import os
import re
import shutil
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path


SERIAL = "127.0.0.1:5555"
PACKAGE = "br.com.painelprime.app"
EVIDENCE = Path("redroid-evidence")
EVIDENCE.mkdir(exist_ok=True)
ADB = shutil.which("adb") or "/usr/local/lib/android/sdk/platform-tools/adb"


def run(*args: str, binary: bool = False) -> bytes | str:
    result = subprocess.run([ADB, "-s", SERIAL, *args], capture_output=True, timeout=50)
    if result.returncode:
        # Nunca inclui os argumentos de input text, que podem conter senhas.
        detail = "" if "input" in args else (result.stdout + result.stderr).decode(
            "utf-8", errors="replace"
        )[:500]
        raise RuntimeError(f"Falha no comando ADB ({args[0]}): {detail}")
    return result.stdout if binary else result.stdout.decode("utf-8", errors="replace")


def ui() -> list[ET.Element]:
    run("shell", "uiautomator", "dump", "/sdcard/painelprime-qa.xml")
    xml = run("exec-out", "cat", "/sdcard/painelprime-qa.xml")
    return list(ET.fromstring(xml).iter("node"))


def label(node: ET.Element) -> str:
    return " ".join((node.get("text", ""), node.get("content-desc", ""))).strip()


def find(text: str, nodes: list[ET.Element] | None = None) -> ET.Element | None:
    for node in nodes or ui():
        if text.casefold() in label(node).casefold():
            return node
    return None


def wait_for(text: str, seconds: int = 45) -> ET.Element:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        node = find(text)
        if node is not None:
            return node
        time.sleep(2)
    raise AssertionError(f"Elemento não apareceu: {text}")


def tap_node(node: ET.Element) -> None:
    bounds = node.get("bounds", "")
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds)
    if not match:
        raise AssertionError("Elemento sem coordenadas de toque")
    x1, y1, x2, y2 = map(int, match.groups())
    run("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))


def tap(text: str, seconds: int = 25) -> None:
    tap_node(wait_for(text, seconds))
    time.sleep(1)


def screenshot(name: str) -> None:
    (EVIDENCE / f"{name}.png").write_bytes(run("exec-out", "screencap", "-p", binary=True))
    (EVIDENCE / f"{name}.xml").write_text(run("exec-out", "cat", "/sdcard/painelprime-qa.xml"), encoding="utf-8")


def ensure_login_screen() -> None:
    if find("Campo de e-mail") is not None:
        return
    if find("Usar e-mail e senha") is not None:
        tap("Usar e-mail e senha")
        wait_for("Campo de e-mail")
        return
    tap("Mais opções")
    tap("Sair da conta")
    wait_for("Campo de e-mail")


def login(email: str, password: str) -> None:
    ensure_login_screen()
    tap("Campo de e-mail")
    run("shell", "input", "text", email)
    tap("Campo de senha")
    run("shell", "input", "text", password)
    tap("Entrar na Plataforma")
    wait_for("Mais opções", 65)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Uso: redroid_decision_inbox.py <apk>")
    team_password = os.environ.get("QA_TEAM_PASSWORD", "")
    owner_password = os.environ.get("QA_OWNER_PASSWORD", "")
    if not team_password or not owner_password:
        raise RuntimeError("Credenciais sintéticas de QA indisponíveis")

    subprocess.run([ADB, "connect", SERIAL], capture_output=True, timeout=20, check=True)
    apk = Path(sys.argv[1]).resolve()
    run("install", "-r", str(apk))
    package_info = run("shell", "dumpsys", "package", PACKAGE)
    if not re.search(r"versionCode=34\b", package_info):
        raise AssertionError("O APK instalado não corresponde ao versionCode 34")
    run("shell", "am", "force-stop", PACKAGE)
    run("shell", "am", "start", "-W", "-n", f"{PACKAGE}/.MainActivity")
    time.sleep(6)

    login("lucas.ferreira@painelprime.com.br", team_password)
    if find("Abrir Plan IA") is not None:
        raise AssertionError("Plan IA apareceu para colaborador")
    tap("Mais opções")
    nodes = ui()
    if find("Central de Reuniões", nodes) is not None:
        raise AssertionError("Reuniões apareceram no menu do colaborador")
    screenshot("colaborador-menu")
    tap("Sair da conta")

    login("google-teste-elite@painelprime.com.br", owner_password)
    tap("Abrir Plan IA")
    tap("Abrir caixa de decisões")
    wait_for("Caixa de decisões")
    for filter_label in ("Pendentes", "Executadas", "Falhas"):
        if find(filter_label) is None:
            raise AssertionError(f"Filtro ausente: {filter_label}")
    screenshot("assinante-caixa-de-decisoes")
    tap("Fechar caixa de decisões")

    log = run("logcat", "-d", "-t", "3000")
    fatal = [line for line in log.splitlines() if
             "FATAL EXCEPTION" in line or f"ANR in {PACKAGE}" in line]
    if fatal:
        raise AssertionError("Crash ou ANR detectado no ReDroid")
    print("Homologação ReDroid: colaborador restrito, assinante com Caixa de decisões e logcat sem crash.")


if __name__ == "__main__":
    main()
