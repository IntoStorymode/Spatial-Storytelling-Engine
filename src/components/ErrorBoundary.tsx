import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * App-wide safety net: a render error in any component (e.g. a malformed story)
 * shows a recoverable message instead of unmounting the whole tree to a blank page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-error" role="alert">
          <h1>Something went wrong.</h1>
          <p>{this.state.error.message}</p>
          <div className="app-error-actions">
            <button className="btn" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            <a className="btn" href="/">
              Back to all stories
            </a>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
