import { CloudOff, RefreshCw } from 'lucide-react';
import type { ApiError } from '@/lib/api';
import { ICON_STROKE } from '@/lib/ui';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

export function ErrorState({ error, onRetry }: { error: ApiError | null; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<CloudOff size={20} strokeWidth={ICON_STROKE} />}
      title={error?.status === 403 ? 'Нет доступа к разделу' : 'Не удалось загрузить данные'}
      description={error?.message}
      action={
        onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry} icon={<RefreshCw size={14} strokeWidth={ICON_STROKE} />}>
            Повторить
          </Button>
        )
      }
    />
  );
}
