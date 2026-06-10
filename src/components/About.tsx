import { UI } from '../theme';

const link: React.CSSProperties = { color: '#64C4FF' };

export function About({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: UI.panel,
          border: `1px solid ${UI.panelBorder}`,
          borderRadius: 12,
          maxWidth: 640,
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '26px 30px',
          fontSize: 13.5,
          lineHeight: 1.7,
          color: UI.textDim,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, color: UI.text }}>About</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: UI.textDim,
              border: `1px solid ${UI.panelBorder}`,
              borderRadius: 6,
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            ✕ Close
          </button>
        </div>

        <p>
          This app visualizes championship points progress and the range of final positions
          every driver, rider, or constructor can still mathematically reach, event by event,
          sprint by sprint.
        </p>

        <h3 style={{ color: UI.text, fontSize: 14, marginBottom: 4 }}>Data sources & thanks</h3>
        <p style={{ marginTop: 0 }}>
          <b style={{ color: UI.text }}>Formula 1</b> results come from the wonderful{' '}
          <a style={link} href="https://github.com/jolpica/jolpica-f1">
            Jolpica-F1 API
          </a>
          , the community-run successor of Chris Newell's{' '}
          <a style={link} href="https://ergast.com/mrd/">
            Ergast API
          </a>{' '}
          that has served the F1 community for nearly two decades. Jolpica mirrors the official{' '}
          <a style={link} href="https://www.formula1.com">
            formula1.com
          </a>{' '}
          classifications — including bonus points, half points and penalties exactly as
          awarded. Huge thanks to its volunteer maintainers; please consider supporting the
          project.
        </p>
        <p>
          <b style={{ color: UI.text }}>MotoGP, Moto2 and Moto3</b> results come from the
          unofficial{' '}
          <a style={link} href="https://www.motogp.com">
            motogp.com
          </a>{' '}
          results API (© Dorna Sports). Thanks to{' '}
          <a style={link} href="https://github.com/robschmitt/MotoGP-API">
            robschmitt/MotoGP-API
          </a>{' '}
          for documenting its endpoints. The API does not accept direct browser requests, so
          this app reaches it through the local dev-server proxy; when that is not possible, a
          fallback notice is shown instead of data.
        </p>

        <h3 style={{ color: UI.text, fontSize: 14, marginBottom: 4 }}>Built with</h3>
        <p style={{ marginTop: 0 }}>
          <a style={link} href="https://react.dev">
            React
          </a>
          ,{' '}
          <a style={link} href="https://vite.dev">
            Vite
          </a>{' '}
          and{' '}
          <a style={link} href="https://d3js.org">
            D3
          </a>{' '}
          (scales and monotone splines). Driver, rider and team icons are generated SVGs; team
          colors follow the familiar broadcast palettes. The source code is{' '}
          <a style={link} href="https://github.com/aozalevsky/championship-points-projector">
            on GitHub
          </a>{' '}
          under the MIT license.
        </p>

        <h3 style={{ color: UI.text, fontSize: 14, marginBottom: 4 }}>Disclaimer</h3>
        <p style={{ marginTop: 0, marginBottom: 0 }}>
          This is an unofficial fan project, not affiliated with, endorsed by, or connected to
          Formula One Group, the FIA, Liberty Media, or Dorna Sports. F1® and related marks are
          trademarks of Formula One Licensing BV. MotoGP™ and related marks are trademarks of
          Dorna Sports SL. No official logos, fonts, photographs, or likenesses are used.
        </p>
      </div>
    </div>
  );
}
