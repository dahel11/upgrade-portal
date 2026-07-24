import { TopBar } from "./TopBar";
import logo from "../assets/colearn-logo-blue.png";

interface StatusScreenProps {
  title: string;
  message: string;
}

export function StatusScreen({ title, message }: StatusScreenProps) {
  return (
    <div className="screen">
      <TopBar />
      <div className="center-message">
        <img src={logo} alt="CoLearn" />
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
    </div>
  );
}
