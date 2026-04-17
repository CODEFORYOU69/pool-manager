"use client";

import Image from "next/image";

export default function AdBanner() {
  return (
    <div className="ad-banner">
      <div className="ad-banner-inner">
        {/* Logo gauche (fixe) */}
        <a
          href="https://andco-sys.com"
          target="_blank"
          rel="noopener noreferrer"
          className="ad-logo-link"
        >
          <Image
            src="/andco-logo.svg"
            alt="&co"
            width={100}
            height={32}
            className="ad-logo"
          />
        </a>

        {/* Texte défilant */}
        <div className="ad-marquee-wrapper">
          <div className="ad-marquee">
            <span className="ad-marquee-text">
              Gérez vos compétitions comme un pro avec{" "}
              <strong>&co</strong> — Inscriptions, pesées, accréditations,
              scoring live, résultats instantanés
              <span className="ad-separator">●</span>
              Rejoignez les fédérations qui nous font confiance
              <span className="ad-separator">●</span>
              <a href="https://andco-sys.com" target="_blank" rel="noopener noreferrer">andco-sys.com</a> — La plateforme tout-en-un pour
              vos événements sportifs
              <span className="ad-separator">●</span>
            </span>
            {/* Duplication pour boucle infinie sans coupure */}
            <span className="ad-marquee-text" aria-hidden="true">
              Gérez vos compétitions comme un pro avec{" "}
              <strong>&co</strong> — Inscriptions, pesées, accréditations,
              scoring live, résultats instantanés
              <span className="ad-separator">●</span>
              Rejoignez les fédérations qui nous font confiance
              <span className="ad-separator">●</span>
              <a href="https://andco-sys.com" target="_blank" rel="noopener noreferrer">andco-sys.com</a> — La plateforme tout-en-un pour
              vos événements sportifs
              <span className="ad-separator">●</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
