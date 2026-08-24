import Image from 'next/image'
import { ArrowDown, ArrowRight, BadgeCheck, Heart, Trophy, UserRound } from 'lucide-react'
import { GameCard } from '@/components/GameCard'
import { ArcadeIntro, IntroReplayButton } from '@/components/ArcadeIntro'
import { Reveal } from '@/components/Reveal'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { originalGames, relatedGames } from '@/data/games'

const platformFeatures = [
  { icon: UserRound, title: 'One player profile', copy: 'A home for scores, favorites, badges, and the games you keep coming back to.' },
  { icon: Trophy, title: 'Shared competition', copy: 'Leaderboards that say what was checked, with each hosted game free to score differently.' },
  { icon: Heart, title: 'Follow the fun', copy: 'Like games, save favorites, and follow creators without turning the arcade into a feed.' },
]

export default function HomePage() {
  return (
    <main id="top">
      <ArcadeIntro />
      <SiteHeader />

      <aside className="signalRail sectionFrame" aria-label="Platform status">
        <span className="signalLive"><span className="signalDot" aria-hidden="true" /> Directory online</span>
        <span>Hosted <strong>04</strong></span>
        <span>Elsewhere <strong>03</strong></span>
        <span>Queued <strong>01</strong></span>
        <IntroReplayButton />
        <span className="signalCode">AVD / ONLINE</span>
      </aside>

      <section className="hero sectionFrame" aria-labelledby="hero-title">
        <div className="heroCopy">
          <p className="kicker"><span /> Game directory · Ideas Realized</p>
          <p className="heroCommand" aria-hidden="true"><span>///</span> play what&apos;s live</p>
          <h1 id="hero-title">Small games.<br /><em>Sharp ideas.</em></h1>
          <p className="heroLead">Play the aVOID originals, find the side projects, and watch this odd little arcade grow into a home for independent web games.</p>
          <div className="heroActions">
            <a className="primaryButton" href="#games">Pick a game <ArrowDown size={17} /></a>
            <a className="textButton" href="#creators">What we&apos;re building <ArrowRight size={16} /></a>
          </div>
          <dl className="heroFacts" aria-label="Current catalog facts">
            <div><dt>04</dt><dd>playable aVOID games</dd></div>
            <div><dt>03</dt><dd>other Ideas Realized games</dd></div>
            <div><dt>01</dt><dd>tank rebuild in the queue</dd></div>
          </dl>
        </div>

        <div className="heroStage" aria-label="aVOID Games artwork">
          <span className="stageCoordinate stageCoordinateTop" aria-hidden="true">ORBIT / 04</span>
          <span className="stageCoordinate stageCoordinateBottom" aria-hidden="true">SIGNAL STABLE</span>
          <div className="orbit orbitOne" />
          <div className="orbit orbitTwo" />
          <div className="heroImageWrap">
            <Image
              src="/avoid-hero.webp"
              alt=""
              fill
              priority
              sizes="(max-width: 760px) 88vw, 470px"
              className="heroImage"
            />
          </div>
          <div className="heroTicket heroTicketTop"><span className="liveDot" /> Directory verified</div>
          <div className="heroTicket heroTicketBottom"><strong>PLAY WHAT&apos;S LIVE</strong><span>Everything else says so.</span></div>
        </div>
      </section>

      <section className="catalogSection" id="games" aria-labelledby="originals-title">
        <div className="sectionFrame">
          <Reveal className="sectionHeading">
            <p className="sectionIndex">/ 01 · aVOID originals</p>
            <div>
              <h2 id="originals-title">Made to play <em>right here.</em></h2>
              <p>Fast browser games with direct controls, strange rules, and no download ceremony.</p>
            </div>
          </Reveal>
          <div className="catalogTelemetry" aria-label="Original game catalog status">
            <span><i aria-hidden="true" /> Hosted collection</span>
            <span>04 live</span>
            <span>01 queued</span>
            <span className="telemetryRule" aria-hidden="true" />
          </div>
          <p className="railHint" aria-hidden="true"><span>Swipe for more</span><i /><ArrowRight /></p>
          <div className="originalGrid" role="region" aria-label="Hosted aVOID games">
            {originalGames.map((game, index) => <GameCard key={game.id} game={game} index={index} />)}
          </div>
        </div>
      </section>

      <section className="elsewhereSection" id="elsewhere" aria-labelledby="elsewhere-title">
        <div className="sectionFrame">
          <Reveal className="sectionHeading">
            <p className="sectionIndex">/ 02 · elsewhere</p>
            <div>
              <h2 id="elsewhere-title">Other games by <em>Ideas Realized.</em></h2>
              <p>These games have their own worlds and their own domains. They do not share the aVOID leaderboard.</p>
            </div>
          </Reveal>
          <p className="railHint railHintDark" aria-hidden="true"><span>Swipe for more</span><i /><ArrowRight /></p>
          <div className="relatedRail" role="region" aria-label="Other games by Ideas Realized">
            {relatedGames.map((game, index) => <GameCard key={game.id} game={game} index={index} compact />)}
          </div>
        </div>
      </section>

      <section className="platformSection" id="creators" aria-labelledby="platform-title">
        <div className="sectionFrame platformGrid">
          <Reveal className="platformIntro">
            <p className="sectionIndex">/ 03 · the platform</p>
            <h2 id="platform-title">A better home for games that are <em>already fun.</em></h2>
            <p>We&apos;re tying the games together with player profiles, leaderboards people can trust, favorites, creator pages, and hosting that makes sense. The games are still the point.</p>
            <div className="buildTag"><BadgeCheck size={16} /> Profiles are live. Older scores are clearly marked while verified scoring is rebuilt.</div>
            <div className="platformAccessLinks">
              <a href="/account/">Open your player deck <ArrowRight aria-hidden="true" /></a>
              <a href="/creators/dashboard/">Creator workspace <ArrowRight aria-hidden="true" /></a>
            </div>
          </Reveal>
          <div className="featureStack">
            {platformFeatures.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Reveal className="featureRow" delay={index * 0.08} key={feature.title}>
                  <span className="featureNumber">0{index + 1}</span>
                  <Icon aria-hidden="true" />
                  <div><h3>{feature.title}</h3><p>{feature.copy}</p></div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      <section className="membershipSection" id="membership" aria-labelledby="membership-title">
        <div className="sectionFrame membershipCard">
          <div className="membershipCopy">
            <Reveal>
              <p className="sectionIndex">/ 04 · founding membership</p>
              <h2 id="membership-title">Back the games.<br /><em>Keep the wins yours.</em></h2>
            </Reveal>
            <p>A Founding Player membership is for people who want fewer ads and more odd little games. It adds profile flair and early experiments. It never touches your score.</p>
            <a className="membershipTicket" href="/membership/">
              <span><i>FOUNDING ACCESS</i><strong>See what membership includes</strong></span>
              <ArrowRight size={19} aria-hidden="true" />
            </a>
          </div>

          <div className="membershipArtifact" aria-hidden="true">
            <span className="artifactSlab artifactSlabBack" />
            <span className="artifactSlab artifactSlabFront" />
            <div className="medalImageWrap">
              <Image src="/brand/founding-player-medal-v2.png" alt="" fill sizes="(max-width: 760px) 70vw, 430px" className="medalImage" />
            </div>
            <div className="foundingTag"><span>FOUNDING</span><strong>PLAYER</strong><i>NO PAY-TO-WIN</i></div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
