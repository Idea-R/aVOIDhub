import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Gamepad2,
  MonitorSmartphone,
  Play,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { notFound } from "next/navigation";
import { SharePageButton } from "@/components/SharePageButton";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { allGames, getGameById, type Game } from "@/data/games";
import { isPlatformRuntimeConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/auth/request-user";

export const dynamic = "force-dynamic";

type ScoreRow = {
  id: string;
  user_id: string | null;
  player_name: string;
  score: number;
  verification_level: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ScoreSnapshot = {
  scores: ScoreRow[];
  personalBest: number | null;
  signedIn: boolean;
  unavailable: boolean;
};

const emptySnapshot: ScoreSnapshot = {
  scores: [],
  personalBest: null,
  signedIn: false,
  unavailable: true,
};

export function generateStaticParams() {
  return allGames.map((game) => ({ slug: game.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const game = getGameById((await params).slug);
  if (!game) return { title: "Game not found" };

  return {
    title: game.title,
    description: game.description,
    alternates: { canonical: game.detailHref },
    openGraph: {
      title: `${game.title} — ${game.genre}`,
      description: game.description,
      url: game.detailHref,
      images: [{ url: game.image }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${game.title} — ${game.genre}`,
      description: game.description,
      images: [game.image],
    },
  };
}

async function getScoreSnapshot(game: Game): Promise<ScoreSnapshot> {
  if (
    game.score.scope !== "platform" ||
    !game.score.gameKey ||
    !isPlatformRuntimeConfigured()
  ) {
    return emptySnapshot;
  }
  try {
    const user = await getRequestUser();
    const admin = createAdminClient();
    const modeByGame = {
      voidavoid: "endless",
      wreckavoid: "wreck-run",
      wordavoid: "classic",
      tankavoid: "five-wave",
    } as const;
    const gameKey = game.score.gameKey;
    const mode = modeByGame[gameKey];
    const { data, error } = await admin
      .from("leaderboard_scores")
      .select(
        "id, user_id, player_name, score, verification_level, metadata, created_at, submission:score_submissions!inner(status, mode)",
      )
      .eq("game_key", gameKey)
      .eq("submission.status", "accepted")
      .eq("submission.mode", mode)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) return { ...emptySnapshot, signedIn: Boolean(user) };
    let personalBest: number | null = null;
    if (user) {
      const { data: best } = await admin
        .from("leaderboard_scores")
        .select("score, submission:score_submissions!inner(status, mode)")
        .eq("game_key", gameKey)
        .eq("user_id", user.id)
        .eq("submission.status", "accepted")
        .eq("submission.mode", mode)
        .order("score", { ascending: false })
        .limit(1)
        .maybeSingle();
      personalBest = typeof best?.score === "number" ? best.score : null;
    }
    return {
      scores: (data ?? []).filter((row, index, rows) =>
        rows.findIndex((candidate) => (candidate.user_id ?? candidate.player_name) === (row.user_id ?? row.player_name)) === index,
      ).slice(0, 10).map(
        ({ id, user_id, player_name, score, verification_level, metadata, created_at }) => ({
          id,
          user_id,
          player_name,
          score,
          verification_level,
          metadata: (metadata ?? {}) as Record<string, unknown>,
          created_at,
        }),
      ) as ScoreRow[],
      personalBest,
      signedIn: Boolean(user),
      unavailable: false,
    };
  } catch {
    return emptySnapshot;
  }
}

function getBoundary(game: Game) {
  if (game.hosting === "hosted") {
    return {
      label: "Hosted aVOID original",
      copy: "The detail page, future profile connection, and score language belong to aVOID. Play still opens in a focused game route.",
    };
  }
  if (game.hosting === "subdomain") {
    return {
      label: "First-party, independently operated",
      copy: "FLIPSIDE is part of the aVOID family, but its current account, commerce, rooms, and scores remain inside FLIPSIDE.",
    };
  }
  return {
    label: "Other game by Ideas Realized",
    copy: `This page introduces the game, then hands off to ${game.destination}. Accounts, saves, scores, and purchases stay there.`,
  };
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const game = getGameById((await params).slug);
  if (!game) notFound();

  const scoreSnapshot = await getScoreSnapshot(game);
  const boundary = getBoundary(game);
  const related = allGames.filter((item) => item.id !== game.id).slice(0, 3);
  const launchesAway = Boolean(game.playHref?.startsWith("http"));
  const gameSchema = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    description: game.description,
    genre: game.genre,
    gamePlatform: "Web browser",
    image: `https://avoidgame.io${game.image}`,
    url: `https://avoidgame.io${game.detailHref}`,
    author: {
      "@type": "Organization",
      name: "Ideas Realized",
      url: "https://ideas-realized.com/",
    },
  };

  return (
    <main
      className="gameDetailPage"
      id="top"
      style={{ "--game-accent": game.accent } as CSSProperties}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(gameSchema) }}
      />
      <SiteHeader />

      <section
        className="gameDetailHero sectionFrame"
        aria-labelledby="game-title"
      >
        <div className="gameDetailCopy">
          <Link className="gameBackLink" href="/#games">
            <ArrowLeft aria-hidden="true" /> All games
          </Link>
          <p className="gameDetailEyebrow">
            {game.eyebrow} / {game.genre}
          </p>
          <h1 id="game-title">{game.title}</h1>
          <p className="gameDetailPremise">{game.premise}</p>
          <div className="gameDetailActions">
            {game.playHref ? (
              <a
                className="gamePlayButton"
                href={game.playHref}
                target={launchesAway ? "_blank" : undefined}
                rel={launchesAway ? "noreferrer" : undefined}
              >
                <span>
                  <i>
                    {launchesAway
                      ? "EXTERNAL GAME"
                      : "PLAY HERE"}
                  </i>
                  <strong>{game.playLabel}</strong>
                </span>
                {launchesAway ? (
                  <ArrowUpRight aria-hidden="true" />
                ) : (
                  <Play fill="currentColor" aria-hidden="true" />
                )}
              </a>
            ) : (
              <div
                className="gameComingControl"
                aria-label="This game is not playable yet"
              >
                <Clock3 aria-hidden="true" />
                <span>
                  <i>HANGAR STATUS</i>
                  <strong>Not playable yet</strong>
                </span>
              </div>
            )}
            <SharePageButton />
          </div>
        </div>

        <div
          className="gameDetailStage"
          aria-label={`${game.title} game artwork`}
        >
          <span className="gameStageNumber" aria-hidden="true">
            {String(allGames.indexOf(game) + 1).padStart(2, "0")}
          </span>
          <div className="gameStageImageWrap">
            <Image
              src={game.image}
              alt=""
              fill
              priority
              sizes="(max-width: 760px) 92vw, 48vw"
              className="gameStageImage"
              style={
                game.imagePosition
                  ? { objectPosition: game.imagePosition }
                  : undefined
              }
            />
          </div>
          <div className="gameStageStatus">
            <span>{game.availability}</span>
            <strong>{game.destination ?? "Not available yet"}</strong>
          </div>
          <span
            className="gameStageOrbit gameStageOrbitOne"
            aria-hidden="true"
          />
          <span
            className="gameStageOrbit gameStageOrbitTwo"
            aria-hidden="true"
          />
        </div>
      </section>

      <section
        className="gameFactRail"
        aria-label={`${game.title} controls and format`}
      >
        <div className="sectionFrame">
          {game.facts.map((fact) => (
            <div key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section
        className="gameExperienceSection sectionFrame"
        aria-labelledby="how-it-plays"
      >
        <div className="gameSectionIntro">
          <p className="sectionIndex">/ how it plays</p>
          <h2 id="how-it-plays">
            Three things to <em>notice.</em>
          </h2>
        </div>
        <div className="gameHighlightGrid">
          {game.highlights.map((highlight, index) => (
            <article className="gameHighlight" key={highlight.title}>
              <span>0{index + 1}</span>
              <h3>{highlight.title}</h3>
              <p>{highlight.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gameStatusSection">
        <div className="sectionFrame gameStatusGrid">
          <article className="gameStatusPanel gameStatusPanelMain">
            <p className="sectionIndex">/ current build</p>
            <h2>{game.availability}</h2>
            <p>{game.statusNote}</p>
            <ul className="gameDeviceList" aria-label="Device support">
              {game.deviceSupport.map((item) => (
                <li key={item}>
                  <MonitorSmartphone aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
          <aside className="gameBoundaryPanel">
            <ShieldCheck aria-hidden="true" />
            <p className="panelLabel">Account and score boundary</p>
            <h3>{boundary.label}</h3>
            <p>{boundary.copy}</p>
          </aside>
        </div>
      </section>

      <section
        className="gameScoreSection sectionFrame"
        aria-labelledby="score-title"
      >
        <div className="gameScoreCopy">
          <p className="sectionIndex">/ scores, honestly</p>
          <Trophy aria-hidden="true" />
          <h2 id="score-title">{game.score.headline}</h2>
          <p>{game.score.copy}</p>
          {game.score.scope === "platform" ? (
            <div className="gamePersonalBest">
              <span>Your personal best</span>
              <strong>
                {scoreSnapshot.personalBest === null
                  ? "—"
                  : scoreSnapshot.personalBest.toLocaleString()}
              </strong>
              <small>
                {scoreSnapshot.signedIn
                  ? "Best saved result for this account."
                  : "Sign in to save runs and view your best score when the board is available."}
              </small>
            </div>
          ) : null}
        </div>

        <div className="gameScoreBoard">
          <div className="gameScoreBoardHead">
            <span>
              {game.score.scope === "platform"
                ? "Platform board"
                : "Score boundary"}
            </span>
            <strong>{game.title}</strong>
          </div>
          {game.score.scope === "platform" && scoreSnapshot.unavailable ? (
            <p className="gameScoreEmpty">
              The live board is currently unavailable. Please try again later.
            </p>
          ) : null}
          {game.score.scope === "platform" &&
          !scoreSnapshot.unavailable &&
          !scoreSnapshot.scores.length ? (
            <p className="gameScoreEmpty">
              No accepted runs yet. Play and submit a run to get on the board.
            </p>
          ) : null}
          {game.score.scope === "platform" ? (
            scoreSnapshot.scores.map((row, index) => (
              <div className="gameScoreRow" key={row.id}>
                <span>
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  {row.player_name}
                </span>
                <em className={`trustPill trust-${row.verification_level}`}>
                  {row.metadata.validationCapability === "server_recomputed"
                    ? "server replay"
                    : row.metadata.validationCapability === "bounds_recomputed"
                      ? "bounded"
                      : row.verification_level}
                </em>
                <strong>{row.score.toLocaleString()}</strong>
              </div>
            ))
          ) : (
            <div className="gameIndependentScore">
              <Gamepad2 aria-hidden="true" />
              <p>
                {game.score.scope === "none"
                  ? "There is no live score service for this game."
                  : `Open ${game.destination} for the records that game chooses to keep.`}
              </p>
            </div>
          )}
          {game.score.scope === "platform" ? (
            <Link
              className="gameBoardLink"
              href={`/leaderboards/?game=${game.score.gameKey}`}
            >
              Open the full platform board <ArrowRight aria-hidden="true" />
            </Link>
          ) : game.playHref ? (
            <a
              className="gameBoardLink"
              href={game.playHref}
              target="_blank"
              rel="noreferrer"
            >
              Continue to {game.destination} <ArrowUpRight aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </section>

      <section className="gameMoreSection" aria-labelledby="more-games">
        <div className="sectionFrame">
          <div className="gameMoreHeading">
            <p className="sectionIndex">/ keep looking</p>
            <h2 id="more-games">
              Three more ways <br />
              <em>to lose track of time.</em>
            </h2>
          </div>
          <div className="gameMoreLinks">
            {related.map((item) => (
              <Link href={item.detailHref} key={item.id}>
                <span style={{ background: item.accent }} aria-hidden="true" />
                <div>
                  <i>{item.eyebrow}</i>
                  <strong>{item.title}</strong>
                </div>
                <ArrowRight aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
