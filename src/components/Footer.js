import React from "react";
import "../styles/Footer.css";

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-logo">
          <img
            src={process.env.PUBLIC_URL + "/logopng.png"}
            alt="KYO"
            className="footer-logo-img"
          />
          <span className="footer-brand">KYO</span>
        </div>
        <div className="footer-info">
          <p className="footer-copyright">
            &copy; {currentYear} KYO - Tous droits r&eacute;serv&eacute;s
          </p>
          <p className="footer-description">
            Gestionnaire de comp&eacute;titions de Taekwondo
          </p>
        </div>
        <div className="footer-links">
          <span className="footer-version">v1.0.0</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
