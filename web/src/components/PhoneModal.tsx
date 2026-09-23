import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import type { LanInfo } from '../../../shared/types.ts'
import { api } from '../api.ts'
import { Modal } from './Modal.tsx'

/** Ouvrir l'app sur son téléphone (même Wi-Fi) via un QR code. */
export function PhoneModal({ onClose }: { onClose: () => void }) {
  const [lan, setLan] = useState<LanInfo | null>(null)
  const [selected, setSelected] = useState(0)
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    api.lan().then(setLan, () => setLan({ enabled: false, urls: [] }))
  }, [])

  const url = lan?.urls[selected]
  useEffect(() => {
    if (!url) return
    QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#15110f', light: '#ebe2d4' } }).then(setQr, () => setQr(null))
  }, [url])

  return (
    <Modal title="Sur ton téléphone" onClose={onClose}>
      {lan === null && <div className="loading"><span className="spinner" /></div>}
      {lan && lan.enabled && url && (
        <div className="phone">
          <div className="qr" dangerouslySetInnerHTML={{ __html: qr ?? '' }} aria-label={`QR code vers ${url}`} />
          <div className="phone-text">
            <p>Scanne ce code avec l'appareil photo du téléphone (connecté au <strong>même Wi-Fi</strong>).</p>
            <code className="phone-url">{url}</code>
            {lan.urls.length > 1 && (
              <div className="phone-urls">
                <span className="muted small">Autres adresses :</span>
                {lan.urls.map((u, i) =>
                  i === selected ? null : (
                    <button key={u} className="link-btn" onClick={() => setSelected(i)}>{u}</button>
                  ),
                )}
              </div>
            )}
            <p className="muted small">
              Astuce : dans le navigateur du téléphone, « Ajouter à l'écran d'accueil » pour l'ouvrir comme une app, en plein écran.
            </p>
          </div>
        </div>
      )}
      {lan && lan.enabled && !url && <p>Aucune adresse réseau local détectée sur ce PC.</p>}
      {lan && !lan.enabled && (
        <div className="phone-off">
          <p>L'accès depuis le réseau local est désactivé (par défaut, l'app n'écoute que sur ce PC).</p>
          <p>Pour l'activer, relance l'app avec :</p>
          <pre><code>npm run build{'\n'}npm run start:lan</code></pre>
          <p className="muted small">
            ⚠️ Il n'y a pas d'authentification : n'importe quel appareil de ton réseau pourra ouvrir l'app. À réserver à ton Wi-Fi perso.
          </p>
        </div>
      )}
    </Modal>
  )
}
