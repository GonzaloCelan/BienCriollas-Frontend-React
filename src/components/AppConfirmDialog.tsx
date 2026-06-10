import * as AlertDialog from "@radix-ui/react-alert-dialog";

import "../styles/appConfirmDialog.css";

type AppConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
};

function AppConfirmDialog({
  open,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  loading = false,
  variant = "primary",
  onConfirm,
  onCancel,
}: AppConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(value) => !value && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="app-confirm__overlay" />

        <AlertDialog.Content className="app-confirm__content">
          <div className="app-confirm__eyebrow">Confirmación requerida</div>

          <AlertDialog.Title className="app-confirm__title">
            {title}
          </AlertDialog.Title>

          <AlertDialog.Description className="app-confirm__description">
            {description}
          </AlertDialog.Description>

          <div className="app-confirm__actions">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                className="app-confirm__btn app-confirm__btn--cancel"
                disabled={loading}
                onClick={onCancel}
              >
                {cancelText}
              </button>
            </AlertDialog.Cancel>

            <AlertDialog.Action asChild>
              <button
                type="button"
                className={`app-confirm__btn app-confirm__btn--${variant}`}
                disabled={loading}
                onClick={onConfirm}
              >
                {loading ? "Procesando..." : confirmText}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export default AppConfirmDialog;