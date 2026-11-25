import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logClientError, ClientErrorRecord } from '../../utils/errorLogger';
import { enableFirestoreMemoryFallback, isFirestoreRuntimeStorageError } from '../../lib/firebase';

interface ModuleErrorBoundaryProps {
  children: React.ReactNode;
  moduleName?: string;
  resetKey?: string;
  onNavigateHome?: () => void;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorRecord: ClientErrorRecord | null;
  isStorageError: boolean;
  retryCount: number;
}

/**
 * Cô lập lỗi theo từng module để lỗi tại một màn hình không làm sập toàn bộ hệ thống
 * (thanh menu bên trái, header và các module khác vẫn hoạt động bình thường).
 */
export default class ModuleErrorBoundary extends React.Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  declare props: ModuleErrorBoundaryProps;
  declare setState: (
    state:
      | Partial<ModuleErrorBoundaryState>
      | ((prevState: Readonly<ModuleErrorBoundaryState>, props: Readonly<ModuleErrorBoundaryProps>) => Partial<ModuleErrorBoundaryState> | null)
      | null,
    callback?: () => void
  ) => void;
  state: ModuleErrorBoundaryState = {
    hasError: false,
    error: null,
    errorRecord: null,
    isStorageError: false,
    retryCount: 0
  };

  static getDerivedStateFromError(error: Error): Partial<ModuleErrorBoundaryState> {
    const isStorage = isFirestoreRuntimeStorageError(error);
    if (isStorage) {
      enableFirestoreMemoryFallback(
        'Hệ thống đã tự động chuyển sang chế độ bộ nhớ tạm an toàn do bộ nhớ lưu trữ trình duyệt đã đầy.'
      );
    }
    return {
      hasError: true,
      error,
      isStorageError: isStorage
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const record = logClientError({
      error,
      componentStack: errorInfo.componentStack,
      source: 'module_error_boundary'
    });
    this.setState({ errorRecord: record });
  }

  componentDidUpdate(prevProps: ModuleErrorBoundaryProps): void {
    // Tự động khôi phục khi người dùng chuyển sang module khác
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({
        hasError: false,
        error: null,
        errorRecord: null,
        isStorageError: false
      });
    }
  }

  handleRetryModule = (): void => {
    if (this.state.isStorageError) {
      window.location.reload();
      return;
    }
    this.setState(prev => ({
      hasError: false,
      error: null,
      errorRecord: null,
      isStorageError: false,
      retryCount: prev.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      const rec = this.state.errorRecord;
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="bg-white p-7 sm:p-8 rounded-2xl border border-slate-200 shadow-lg max-w-lg w-full text-center space-y-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto border ${
                this.state.isStorageError
                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : 'bg-rose-50 text-rose-600 border-rose-200'
              }`}
            >
              <AlertTriangle size={28} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-extrabold text-slate-900">
                {this.state.isStorageError
                  ? 'Bộ nhớ lưu trữ trình duyệt đã đầy'
                  : `Đã xảy ra sự cố tại ${this.props.moduleName || 'module này'}`}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {this.state.isStorageError
                  ? 'Trình duyệt trên máy tính này không đủ dung lượng bộ nhớ cục bộ. Dữ liệu máy chủ vẫn an toàn.'
                  : 'Lỗi đã được cô lập trong phạm vi module này và không ảnh hưởng tới dữ liệu hay các chức năng khác của hệ thống.'}
              </p>
            </div>

            {rec && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left text-[11px] text-slate-600 space-y-1 font-mono">
                <p>
                  <strong className="text-slate-800">Lỗi:</strong> {rec.errorName}
                </p>
                <p className="break-words">
                  <strong className="text-slate-800">Chi tiết:</strong> {rec.errorMessage}
                </p>
                <p>
                  <strong className="text-slate-800">Thành phần:</strong> {rec.componentName} •{' '}
                  <strong className="text-slate-800">Phiên bản:</strong> {rec.appVersion}
                </p>
                <p>
                  <strong className="text-slate-800">Trình duyệt:</strong> {rec.browserName}{' '}
                  {rec.browserVersion}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleRetryModule}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                <RefreshCw size={15} />
                {this.state.isStorageError ? 'Tải lại ở chế độ an toàn' : 'Thử tải lại module'}
              </button>

              {this.props.onNavigateHome && (
                <button
                  type="button"
                  onClick={this.props.onNavigateHome}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
                >
                  <Home size={15} />
                  Về Trang chủ
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return <React.Fragment key={this.state.retryCount}>{this.props.children}</React.Fragment>;
  }
}
