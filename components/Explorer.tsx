"use client";

import { useCampaign } from "@/lib/campaign/CampaignProvider";
import { useWindows } from "@/components/windows/WindowManager";
import { Folder, LockedFolder } from "@/components/Folder";
import { DossieWindow, LockedDossieWindow } from "@/components/DossieWindow";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { BoardWindow } from "@/components/BoardWindow";
import { MasterPanelWindow, SynopsisWindow } from "@/components/MasterPanelWindow";
import { ReferenceWindow } from "@/components/ReferenceWindow";
import { BroadcastWindow } from "@/components/BroadcastWindow";
import { COLORS } from "@/lib/game/rules";

export function Explorer() {
  const { campaign, isGM, meId, metaOf, directory, characters, totalUnread } = useCampaign();
  const windows = useWindows();

  // `directory` lista todos os personagens da mesa (nome + arquétipo);
  // `characters` só os que a RLS deixou passar. A diferença vira pasta trancada.
  const visibleIds = new Set(characters.map((c) => c.id));

  const openDossie = (id: string, name: string) =>
    windows.open(`dossie:${id}`, `${name} — Dossiê`, <DossieWindow characterId={id} />);

  return (
    <div className="explorer-screen">
      <div className="taskbar">
        <div className="brand">
          <span className="dot" />
          EFEITOS COLATERAIS
          <span style={{ opacity: 0.5, fontWeight: 400 }}>/ {campaign.name}</span>
        </div>
        <div className="who">
          <span>{metaOf(meId).name.toUpperCase()}</span>
          <span className="role-badge" style={{ color: isGM ? "#e6543c" : "#8fbf9a" }}>
            {isGM ? "Acesso total" : "Agente de campo"}
          </span>
          {isGM && (
            <button
              className="logout-btn"
              onClick={() =>
                windows.open(
                  "broadcast",
                  "Narração do Mestre",
                  <BroadcastWindow onSent={() => windows.close("broadcast")} />,
                )
              }
            >
              📢 Narração
            </button>
          )}
          <a className="logout-btn" href="/campanhas">
            Mesas
          </a>
          <form action="/auth/signout" method="post">
            <button className="logout-btn" type="submit">
              Sair
            </button>
          </form>
        </div>
      </div>

      <div className="desktop">
        {directory.map((entry) =>
          visibleIds.has(entry.id) ? (
            <Folder
              key={entry.id}
              label={entry.name}
              sub={`${entry.archetype.toUpperCase()} · DOSSIÊ`}
              color={COLORS[entry.archetype]}
              onOpen={() => openDossie(entry.id, entry.name)}
            />
          ) : (
            <LockedFolder
              key={entry.id}
              name={entry.name}
              onOpen={() =>
                windows.open(
                  `locked:${entry.id}`,
                  "Acesso Restrito",
                  <LockedDossieWindow name={entry.name} />,
                )
              }
            />
          ),
        )}

        <Folder
          label="Comunicações"
          sub="Interceptações"
          color="#5c5340"
          badge={totalUnread}
          onOpen={() => windows.open("chat", "Comunicações", <ChatWindow />)}
        />

        <Folder
          label="Mural de Evidências"
          sub="Quadro de pistas"
          color="#6b4a2d"
          onOpen={() => windows.open("board", "Mural de Evidências", <BoardWindow />)}
        />

        {isGM ? (
          <>
            <Folder
              label="Painel do Mestre"
              sub="Visão geral"
              color="#b8860b"
              onOpen={() =>
                windows.open(
                  "master",
                  "Painel do Mestre",
                  <MasterPanelWindow
                    onOpenDossie={(id) => {
                      const entry = directory.find((d) => d.id === id);
                      windows.close("master");
                      openDossie(id, entry?.name ?? "Dossiê");
                    }}
                  />,
                )
              }
            />
            <Folder
              label="Referência Rápida"
              sub="Regras"
              color="#2e6b64"
              onOpen={() => windows.open("reference", "Referência Rápida", <ReferenceWindow />)}
            />
          </>
        ) : (
          <Folder
            label="Sinopse do Ato"
            sub="Contexto"
            color="#b8860b"
            onOpen={() => windows.open("synopsis", "Sinopse do Ato", <SynopsisWindow />)}
          />
        )}
      </div>
    </div>
  );
}
