import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-[60vh] place-items-center p-6">
          <div className="card max-w-md p-8 text-center">
            <p className="mb-2 text-lg font-bold text-slate-800">Une erreur est survenue</p>
            <p className="mb-4 text-sm text-slate-500">{this.state.error?.message || 'Erreur inconnue'}</p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Réessayer
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
