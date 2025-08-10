import Header from '../components/Header';

const MTGRules: React.FC = () => (
  <div className="App">
    <Header />
    <div style={{ maxWidth: '700px', margin: '2em auto', background: '#181818', borderRadius: '12px', padding: '2em', color: '#fff', boxShadow: '0 2px 12px #0006', textAlign: 'left' }}>
      <h2 style={{ fontSize: '1.2em', marginBottom: '1em', fontWeight: 'bold' }}>MTG Combat Example</h2>
      <p style={{ fontSize: '1em', lineHeight: '1.7', margin: 0 }}>
        You attack with a <b>6/6</b>.<br />
        Opponent blocks with two <b>3/3s</b>.<br /><br />
        Before combat damage, you cast <b>Giant Growth (+3/+3)</b> on your creature, making it <b>9/9</b>.<br /><br />
        In the Combat Damage step, you can now assign <b>3 damage</b> to each 3/3 (enough to kill them) and send the remaining <b>3 damage</b> to your opponent <b>if you have trample</b>.<br /><br />
        Without trample, you can still assign the damage in any split (e.g., all 9 to one blocker, or 5 to one and 4 to the other).
      </p>
    </div>
  </div>
);

export default MTGRules;
