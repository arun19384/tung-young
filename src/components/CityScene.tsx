export function CityScene() {
  return (
    <div className="city-scene" aria-hidden="true">
      <div className="sun" />
      <div className="cloud cloud-one" />
      <div className="cloud cloud-two" />
      <div className="skyline">
        {[42, 72, 51, 103, 64, 88, 132, 69, 98, 56, 112, 75, 92, 55].map(
          (h, i) => (
            <div key={i} style={{ height: h }}>
              <i />
              <i />
              <i />
            </div>
          ),
        )}
      </div>
      <div className="trees">♣ ♣ ♣</div>
      <div className="viaduct">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="city-train">
        <div className="train-front" />
        {Array.from({ length: 9 }, (_, i) => (
          <i key={i} />
        ))}
        <b />
      </div>
      <span className="scene-note">
        อีกนิดเดียว
        <br />
        ก็ถึงแล้ว :)
      </span>
    </div>
  );
}
