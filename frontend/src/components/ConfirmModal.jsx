export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  onSecondary,
  title,
  message,
  confirmText = "Conferma",
  cancelText = "Annulla",
  secondaryText = "Rifiuta",
  type = "default"
}) {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-card">
        <div className="modal-head">
          <h3>{title}</h3>
          <button 
            type="button" 
            className="modal-close"
            onClick={onClose}
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn outline"
            onClick={onClose}
          >
            {cancelText}
          </button>
          {onSecondary && (
            <button
              type="button"
              className="btn danger"
              onClick={onSecondary}
            >
              {secondaryText}
            </button>
          )}
          <button
            type="button"
            className={`btn ${type === 'danger' ? 'danger' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}