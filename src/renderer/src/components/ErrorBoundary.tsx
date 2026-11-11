import React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { APP_CONFIG } from '../../../shared/appConfig'

interface ErrorBoundaryState {
  hasError: boolean
  errorMessage: string
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected rendering error occurred.'
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[${APP_CONFIG.name}] UI ErrorBoundary caught error:`, error, info.componentStack)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: '#0b1020',
            color: '#f8fafc',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          <div
            style={{
              maxWidth: 420,
              width: '100%',
              background: '#131b2e',
              border: '1px solid rgba(244, 63, 94, 0.35)',
              borderRadius: 14,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              textAlign: 'center',
              alignItems: 'center'
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(244, 63, 94, 0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <AlertTriangle size={22} color="#f43f5e" />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
              Something went wrong in {APP_CONFIG.name}
            </h2>
            <p style={{ fontSize: 12.5, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
              Your saved tasks and schedules are safe in local storage. Reload the interface to continue.
            </p>
            {this.state.errorMessage && (
              <pre
                style={{
                  width: '100%',
                  background: '#0b1020',
                  border: '1px solid rgba(148, 163, 184, 0.15)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: 11,
                  color: '#fda4af',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                  textAlign: 'left'
                }}
              >
                {this.state.errorMessage}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 18px',
                borderRadius: 9999,
                border: 'none',
                background: '#a788fa',
                color: '#0b1020',
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
                marginTop: 4
              }}
            >
              <RotateCcw size={14} /> Reload {APP_CONFIG.name}
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

