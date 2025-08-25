import { useParams } from "react-router-dom";
import App from "./components/App";

const AppWrapper = () => {
  const { id } = useParams();

  if (!id) return <p>ID no encontrada en la URL</p>;

  return <App id={id} />;
};

export default AppWrapper;
