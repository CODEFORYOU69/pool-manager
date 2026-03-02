import React from "react";
import "../styles/HomePage.css";

function HomePage({ onStart }) {
  return (
    <div className="homepage">
      <div className="homepage-logo-container">
        <div className="homepage-logo-glow" />
        <img
          src={process.env.PUBLIC_URL + "/logopng.png"}
          alt="KYO Logo"
          className="homepage-logo"
        />
      </div>
      <p className="homepage-subtitle">Gestionnaire de Compétitions</p>
      <button className="homepage-start-btn" onClick={onStart}>
        <span>Commencer</span>
      </button>
    </div>
  );
}

export default HomePage;
