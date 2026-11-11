"""Homologa missões e isolamento dos dois perfis de QA no ReDroid."""

import os
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
    for _ in range(25):
        time.sleep(1)
        root = dump(name)
        if node_for(root, label) is not None:
            return root
    raise AssertionError(f"Conteúdo esperado não apareceu: {label}")


def tap_scrolling(label: str, name: str) -> None:
    for attempt in range(5):
        root = dump(f"{name}-{attempt}")
        if node_for(root, label) is not None:
            tap(root, label)
            return
        adb("shell", "input", "swipe", "540", "1900", "540", "550", "400")
        time.sleep(1)
    raise AssertionError(f"Controle não encontrado após rolar: {label}")


owner_email = os.environ["REDROID_QA_OWNER_EMAIL"]
owner_password = os.environ["REDROID_QA_OWNER_PASSWORD"]
team_email = os.environ["REDROID_QA_TEAM_EMAIL"]
team_password = os.environ["REDROID_QA_TEAM_PASSWORD"]


def sign_out_and_sign_in(email: str, password: str, prefix: str) -> None:
    tap_scrolling("Sair da conta", f"{prefix}-more-scroll")
    for _ in range(25):
        time.sleep(1)
        login = dump(f"{prefix}-login")
        if node_for(login, "Campo de e-mail") is not None:
            break
        if node_for(login, "Acessar Conta") is not None:
            tap(login, "Acessar Conta")
    else:
        raise AssertionError("A tela de login não abriu após sair da conta")

    tap(login, "Campo de e-mail")
    adb("shell", "input", "text", email)
    tap(dump(f"{prefix}-login-email"), "Campo de senha")
    adb("shell", "input", "text", password)
    adb("shell", "input", "keyevent", "4")
    tap(dump(f"{prefix}-login-ready"), "Entrar na Plataforma")
    wait_for("Mais opções", f"{prefix}-home")


home = dump("owner-home")
tap(home, "Mais opções")
more = wait_for("Missões e conquistas", "owner-more")
if owner_email not in ET.tostring(more, encoding="unicode"):
    sign_out_and_sign_in(owner_email, owner_password, "owner-reset")
    tap(dump("owner-reset-home"), "Mais opções")
    more = wait_for("Missões e conquistas", "owner-more-reset")
    if owner_email not in ET.tostring(more, encoding="unicode"):
        raise AssertionError("Não foi possível autenticar a assinante de QA")
tap(more, "Missões e conquistas")
missions = wait_for("Encontre seu próximo passo", "owner-missions")
if node_for(missions, "Não foi possível carregar suas missões") is not None:
    raise AssertionError("A consulta de missões falhou no perfil assinante")
tap(missions, "Selecionar evento Casamento Helena")
time.sleep(3)
event_missions = dump("owner-event-missions")
if node_for(event_missions, "Adicione os convidados. Escolha um evento") is not None:
    raise AssertionError("A missão não recebeu o contexto do evento selecionado")
if node_for(event_missions, "Não foi possível carregar suas missões") is not None:
    raise AssertionError("A consulta do evento falhou no perfil assinante")
missions = event_missions
tap(missions, "Conquistas")
achievements = wait_for("Assessoria identificada", "owner-achievements")
if node_for(achievements, "Não foi possível carregar suas missões") is not None:
    raise AssertionError("A coleção de conquistas falhou no perfil assinante")
print("Sessão assinante: missões e conquistas verificadas com contexto de evento.")

tap(achievements, "Voltar para a tela anterior")
after_back = dump("owner-after-back")
if node_for(after_back, "Missões e conquistas") is None:
    tap(after_back, "Mais opções")
wait_for("Missões e conquistas", "owner-more-return")
sign_out_and_sign_in(team_email, team_password, "team")
team_home = wait_for("Mais opções", "team-home")
if node_for(team_home, "Plan IA") is not None:
    raise AssertionError("O perfil de equipe recebeu acesso à Plan IA")
tap(team_home, "Mais opções")
team_more = wait_for("Missões e conquistas", "team-more")
if team_email not in ET.tostring(team_more, encoding="unicode"):
    raise AssertionError("A sessão atual não pertence ao colaborador de QA")
tap(team_more, "Missões e conquistas")
team_context = wait_for("Selecionar evento", "team-context")
if node_for(team_context, "Assessoria") is not None:
    raise AssertionError("O modo operacional expôs o contexto de assessoria")
tap(team_context, "Selecionar evento")
team_missions = wait_for("Consulte seu cronograma", "team-missions")
if node_for(team_missions, "Peça ajuda à Plan IA") is not None or node_for(team_missions, "Registre um valor real") is not None:
    raise AssertionError("O perfil de equipe recebeu missões executivas")
if node_for(team_missions, "Trabalhe na portaria") is None:
    raise AssertionError("A orientação de Portaria não apareceu para a equipe")
tap(team_missions, "Conquistas")
wait_for("Nenhuma conquista disponível", "team-achievements")
print("Sessão colaborador: apenas orientações operacionais e contexto da escala.")
