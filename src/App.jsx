import { useRef, useState, useEffect, Component } from "react";
import Speedtest from "./lib/speedtest";

class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ textAlign: "center", padding: "2em", color: "#ff0000" }}>
          <h2>Произошла ошибка</h2>
          <p>{this.state.error?.message || "Неизвестная ошибка"}</p>
          <p>Пожалуйста, перезагрузите страницу или свяжитесь с поддержкой.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [uiData, setUiData] = useState(null);
  const [testState, setTestState] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  const speedtest = useRef(new Speedtest());
  const timerRef = useRef(null);

  const format = (d) => {
    d = Number(d);
    if (d < 10) return d.toFixed(2);
    if (d < 100) return d.toFixed(1);
    return d.toFixed(0);
  };

  // вычисление заполнения шкалы
  const getProgress = (value) => {
    if (!value) return 0;
    let max = 150;
    if (value > 150 && value <= 1100) max = 1100;
    else if (value > 1100) max = 5000;
    return Math.min(100, (value / max) * 100);
  };

  useEffect(() => {
    clearInterval(timerRef.current);
  
    if (testState === 1 || testState === 3) {
      setTimer(0);
      timerRef.current = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [testState]);
  

  const startStop = () => {
    if (speedtest.current.getState() === 3) {
      speedtest.current.abort();
      setUiData(null);
      setTestState(-1);
    } else {
      speedtest.current.onupdate = (data) => {
        setUiData(data);
        setTestState(data.testState);
      };

      speedtest.current.onend = (aborted) => {
        setTestState(aborted ? 5 : 4);

        if (!aborted) {
          setUiData((prev) => {
            if (!prev) return prev;
            const shareURL = `${window.location.origin}/results/?id=${prev.testId}`;
            return { ...prev, shareURL };
          });
        }
      };

      speedtest.current.start();
      setTestState(3);
    }
  };

  return (
    <ErrorBoundary>
      <div className="testWrapper">
            {/* Ping */}
            <div className="ping__container">
              <div>Ping</div>
              <div id="pingText" className="meterText">
                {uiData?.pingStatus ? format(uiData.pingStatus) : ""}
              </div>
              <div className="unit">ms</div>
            </div>

            {/* Download */}
            <div className="speed__contanier">
              <div>Входящая скорость</div>
              <div className="progress">
                <div
                  className="progress-bar"
                  style={{ width: `${getProgress(uiData?.dlStatus)}%` }}>
                <div
                  className={`progress-text ${uiData?.dlStatus === undefined || uiData?.dlStatus < 10 ? "low" : "normal"}`}
                >
                  {format(uiData?.dlStatus || 0)} Mbit/s
                </div>
              </div>
            </div>
          </div>
                    
            {/* Upload */}
            <div className="speed__contanier">
              <div>Исходящая скорость</div>
              <div className="progress">
                <div
                  className="progress-bar"
                  style={{ width: `${getProgress(uiData?.ulStatus)}%` }}>
                  <div
                  className={`progress-text ${uiData?.dlStatus === undefined || uiData?.dlStatus < 10 ? "low" : "normal"}`}
                  >
                  {format(uiData?.ulStatus || 0)} Mbit/s
                  </div>
                </div>
            </div>

            {/* Таймер */}
            {testState !== -1 && (
              <div className="timer">Время теста: {timer} c</div>
            )}

            {/* IP */}
            <div id="ipArea">
              <span id="ip">{uiData?.clientIp}</span>
            </div>
          </div>
            
          <div
              className={testState !== -1 ? "button running" : "button stop"}
              id="startStopBtn"
              onClick={startStop}
          >Старт</div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
