import Header from '../components/Header';

const MTGRules: React.FC = () => (
  <div className="App">
    <Header />
    <div style={{
        maxWidth: '900px',
        margin: '2em auto',
        background: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
        color: '#f8f8f8',
        borderRadius: '18px',
        padding: '2.5em 2em',
        boxShadow: '0 4px 24px #0008',
        fontFamily: 'Merriweather, Georgia, serif',
        border: '1px solid #444',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'left',
        columnCount: 2,
        columnGap: '2.5em',
        columnRule: '1px solid #444',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '1.5em',
          paddingBottom: '0.5em',
          borderBottom: '2px solid #444',
          letterSpacing: '0.04em',
        }}>
          <h1 style={{
            fontFamily: 'Cinzel, Georgia, serif',
            fontSize: '2.4em',
            fontWeight: 700,
            margin: 0,
            color: '#ffd700',
            textShadow: '0 2px 8px #000a',
            letterSpacing: '0.08em',
          }}>Magic: The Gathering / Proxy The Gathering</h1>
          <h2 style={{
            fontFamily: 'Merriweather, Georgia, serif',
            fontSize: '1.3em',
            fontWeight: 400,
            margin: '0.3em 0 0.2em 0',
            color: '#fff',
            textShadow: '0 1px 4px #0007',
            letterSpacing: '0.04em',
          }}>Rules Booklet</h2>
        </div>
        <h2>1. Game Overview</h2>
        <p>Magic: The Gathering is a trading card game for two or more players. Each player starts with 20 life and a deck of at least 60 cards. The goal is to reduce your opponent’s life total to 0, or cause them to be unable to draw a card when required.</p>
        <h2>2. Deck Construction</h2>
  <ul style={{ textAlign: 'left', marginLeft: '1.5em' }}>
          <li><strong>Minimum Deck Size:</strong> 60 cards</li>
          <li><strong>Maximum Copies:</strong> 4 of any card (except basic lands)</li>
          <li><strong>Sideboard:</strong> Up to 15 cards (used between games in a match)</li>
        </ul>
        <h2>3. Card Types</h2>
        <table style={{ width: '100%', background: '#333', color: '#fff', borderCollapse: 'collapse', marginBottom: '1em' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #444', padding: '0.5em' }}>Type</th>
              <th style={{ border: '1px solid #444', padding: '0.5em' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={{ border: '1px solid #444', padding: '0.5em' }}>Land</td><td style={{ border: '1px solid #444', padding: '0.5em' }}>Produces mana. Can be played once per turn.</td></tr>
            <tr><td style={{ border: '1px solid #444', padding: '0.5em' }}>Creature</td><td style={{ border: '1px solid #444', padding: '0.5em' }}>Can attack and block. Has power/toughness (e.g., 2/3).</td></tr>
            <tr><td style={{ border: '1px solid #444', padding: '0.5em' }}>Instant</td><td style={{ border: '1px solid #444', padding: '0.5em' }}>Can be cast at any time, even during opponent’s turn.</td></tr>
            <tr><td style={{ border: '1px solid #444', padding: '0.5em' }}>Sorcery</td><td style={{ border: '1px solid #444', padding: '0.5em' }}>Can only be cast during your main phase when the stack is empty.</td></tr>
            <tr><td style={{ border: '1px solid #444', padding: '0.5em' }}>Artifact</td><td style={{ border: '1px solid #444', padding: '0.5em' }}>Represents magical items or technology.</td></tr>
            <tr><td style={{ border: '1px solid #444', padding: '0.5em' }}>Enchantment</td><td style={{ border: '1px solid #444', padding: '0.5em' }}>Usually has a lasting effect. Can enchant permanents or the battlefield.</td></tr>
            <tr><td style={{ border: '1px solid #444', padding: '0.5em' }}>Planeswalker</td><td style={{ border: '1px solid #444', padding: '0.5em' }}>Represents powerful allies. Has loyalty counters and abilities.</td></tr>
          </tbody>
        </table>
        <h2>4. Game Phases (Turn Structure)</h2>
  <ol style={{ textAlign: 'left', marginLeft: '1.5em' }}>
          <li><strong>Beginning Phase</strong>
            <ul>
              <li><strong>Untap Step:</strong> Untap all tapped permanents.</li>
              <li><strong>Upkeep Step:</strong> Some cards have effects that trigger here.</li>
              <li><strong>Draw Step:</strong> Draw a card.</li>
            </ul>
          </li>
          <li><strong>Precombat Main Phase</strong>
            <ul><li>Play lands, cast spells, and activate abilities.</li></ul>
          </li>
          <li><strong>Combat Phase</strong>
            <ul>
              <li><strong>Declare Attackers:</strong> Choose which creatures attack.</li>
              <li><strong>Declare Blockers:</strong> Opponent chooses which creatures block.</li>
              <li><strong>Combat Damage:</strong> Damage is dealt simultaneously.</li>
            </ul>
          </li>
          <li><strong>Postcombat Main Phase</strong>
            <ul><li>Play lands, cast spells, and activate abilities.</li></ul>
          </li>
          <li><strong>Ending Phase</strong>
            <ul>
              <li><strong>End Step:</strong> Some cards have effects that trigger here.</li>
              <li><strong>Cleanup Step:</strong> Discard down to your maximum hand size (7 cards).</li>
            </ul>
          </li>
        </ol>
        <h2>5. Mana System</h2>
  <ul style={{ textAlign: 'left', marginLeft: '1.5em' }}>
          <li><strong>Mana Cost:</strong> Paid by tapping lands or other mana sources.</li>
          <li><strong>Mana Pool:</strong> Mana is added here and empties at the end of each step/phase.</li>
          <li><strong>Color Identity:</strong> Determines which mana colors you can use (based on cards in your deck).</li>
        </ul>
        <h2>6. Combat Rules</h2>
  <ul style={{ textAlign: 'left', marginLeft: '1.5em' }}>
          <li><strong>Attacking:</strong> Tap creatures to attack. They deal damage equal to their power.</li>
          <li><strong>Blocking:</strong> Untapped creatures can block attackers.</li>
          <li><strong>Damage:</strong> Assigned by the attacking/blocking player. Unblocked creatures deal damage to the defending player.</li>
          <li><strong>First Strike/Double Strike:</strong> Damage is dealt before/after normal combat damage.</li>
        </ul>
        <h2 style={{ fontSize: '1.2em', marginBottom: '1em', fontWeight: 'bold' }}>MTG Combat Example</h2>
        <p style={{ fontSize: '1em', lineHeight: '1.7', margin: 0 }}>
          You attack with a <b>6/6</b>.<br />
          Opponent blocks with two <b>3/3s</b>.<br /><br />
          Before combat damage, you cast <b>Giant Growth (+3/+3)</b> on your creature, making it <b>9/9</b>.<br /><br />
          In the Combat Damage step, you can now assign <b>3 damage</b> to each 3/3 (enough to kill them) and send the remaining <b>3 damage</b> to your opponent <b>if you have trample</b>.<br /><br />
          Without trample, you can still assign the damage in any split (e.g., all 9 to one blocker, or 5 to one and 4 to the other).
        </p>
        <h2>7. The Stack</h2>
        <ul style={{ textAlign: 'left', marginLeft: '1.5em' }}>
          <li><strong>Definition:</strong> The Stack is where spells and abilities go after being cast or activated, but before they take effect.</li>
          <li><strong>Order:</strong> The last spell or ability added resolves first (Last-In, First-Out).</li>
          <li><strong>Responses:</strong> Players can cast instants or activate abilities in response to what’s on the Stack.</li>
          <li><strong>Resolution:</strong> The top item resolves, then is removed. This continues until the Stack is empty.</li>
        </ul>
        <h2>8. Priority</h2>
        <ul style={{ textAlign: 'left', marginLeft: '1.5em' }}>
          <li><strong>Definition:</strong> Priority is the permission to take actions, like casting spells or activating abilities.</li>
          <li><strong>Who Has It:</strong> The active player (whose turn it is) gets priority first. If they pass, their opponent may take it.</li>
          <li><strong>Passing Priority:</strong> If all players pass priority in succession, the top spell or ability on the Stack resolves.</li>
          <li><strong>Retaining Priority:</strong> After casting a spell or activating an ability, the same player keeps priority unless they choose to pass it.</li>
        </ul>
  <h2>9. Common Keywords</h2>
        <table style={{ width: '100%', background: '#333', color: '#fff', borderCollapse: 'collapse', marginBottom: '1em' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #444', padding: '0.5em' }}>Keyword</th>
              <th style={{ border: '1px solid #444', padding: '0.5em' }}>Effect</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={{ border: '1px solid #444', padding: '0.5em' }}>Flying</td><td style={{ border: '1px solid #444', padding: '0.5em' }}>Can only be blocked by creatures with flying or reach.</td></tr>
            <tr><td style={{ border: '1px solid #444', padding: '0.5em' }}>Trample</td><td style={{ border: '1px solid #444', padding: '0.5em' }}>Excess damage is dealt to the defending player.</td></tr>
            <tr><td style={{ border: '1px solid #444', padding: '0.5em' }}>Haste</td><td style={{ border: '1px solid #444', padding: '0.5em' }}>Can attack or tap for abilities the turn it enters the battlefield.</td></tr>
            <tr><td style={{ border: '1px solid #444', padding: '0.5em' }}>Hexproof</td><td style={{ border: '1px solid #444', padding: '0.5em' }}>Can’t be the target of spells or abilities your opponents control.</td></tr>
            <tr><td style={{ border: '1px solid #444', padding: '0.5em' }}>Lifelink</td><td style={{ border: '1px solid #444', padding: '0.5em' }}>Damage dealt also causes you to gain that much life.</td></tr>
            <tr><td style={{ border: '1px solid #444', padding: '0.5em' }}>Deathtouch</td><td style={{ border: '1px solid #444', padding: '0.5em' }}>Any amount of damage dealt to a creature with deathtouch is lethal.</td></tr>
            <tr><td style={{ border: '1px solid #444', padding: '0.5em' }}>Vigilance</td><td style={{ border: '1px solid #444', padding: '0.5em' }}>Attacks/blocks without tapping.</td></tr>
          </tbody>
        </table>
  <h2>10. Winning the Game</h2>
  <ul style={{ textAlign: 'left', marginLeft: '1.5em' }}>
          <li>Reduce opponent’s life to 0.</li>
          <li>Cause opponent to draw from an empty library.</li>
          <li>Use cards with alternate win conditions (e.g., Thassa’s Oracle, Approach of the Second Sun).</li>
        </ul>
  <h2>11. Losing the Game</h2>
  <ul style={{ textAlign: 'left', marginLeft: '1.5em' }}>
          <li>Life total reaches 0 or less.</li>
          <li>Must draw a card but library is empty.</li>
          <li>Have 10 or more poison counters.</li>
          <li>Specific card effects (e.g., “You lose the game”).</li>
        </ul>
  <h2>12. Multiplayer Rules</h2>
  <ul style={{ textAlign: 'left', marginLeft: '1.5em' }}>
          <li><strong>Free-for-All:</strong> Last player standing wins.</li>
          <li><strong>Two-Headed Giant:</strong> Teams of two, shared life total (30), shared turns.</li>
          <li><strong>Commander:</strong> 100-card singleton deck, one legendary creature as commander.</li>
        </ul>
  <h2>13. Glossary</h2>
        <ul>
          <li><strong>Permanent:</strong> A card on the battlefield (creatures, artifacts, enchantments, lands, planeswalkers).</li>
          <li><strong>Exile:</strong> A zone where cards are removed from the game.</li>
          <li><strong>Graveyard:</strong> Where cards go after being destroyed or discarded.</li>
          <li><strong>Library:</strong> Your deck of cards.</li>
          <li><strong>Hand:</strong> Cards you hold.</li>
        </ul>
        <hr />
        <p><strong>Note:</strong> This booklet is a summary. For official rules, refer to the <a href="https://magic.wizards.com/en/rules" target="_blank" rel="noopener noreferrer" style={{ color: '#90caf9' }}>MTG Comprehensive Rules</a>.</p>
      </div>
    </div>
  );

export default MTGRules;
