import { Component, type ReactNode } from "react";

export class RecoveryBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  private timer?: ReturnType<typeof setTimeout>;
  static getDerivedStateFromError() {
    return { failed: true };
  }
  private recover = () => {
    if (this.timer) return;
    this.setState({ failed: true });
    // Avoid a reload loop if the initial screen itself cannot load.
    if (
      window.location.pathname === "/screens/00" &&
      new URLSearchParams(window.location.search).has("recovered")
    )
      return;
    this.timer = setTimeout(
      () => window.location.replace("/screens/00?recovered=1"),
      2000,
    );
  };
  private onError = (event: ErrorEvent) => {
    if (event.error) this.recover();
  };
  componentDidCatch() {
    this.recover();
  }
  componentDidMount() {
    window.addEventListener("error", this.onError);
    window.addEventListener("unhandledrejection", this.recover);
    window.addEventListener("app-timeout", this.recover);
  }
  componentWillUnmount() {
    clearTimeout(this.timer);
    window.removeEventListener("error", this.onError);
    window.removeEventListener("unhandledrejection", this.recover);
    window.removeEventListener("app-timeout", this.recover);
  }
  render() {
    if (this.state.failed)
      return (
        <main>
          <div role="alert" className="notice error">
            오류가 발생했습니다. 첫 번째 화면으로 돌아갑니다.
          </div>
          <a href="/screens/00?recovered=1">첫 번째 화면으로 이동</a>
        </main>
      );
    return this.props.children;
  }
}
