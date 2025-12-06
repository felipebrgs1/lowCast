import { render } from "preact";
import Router from "preact-router";
import { useCliNavigation } from "./hooks/useCliNavigation";
import { useGlobalShortcut } from "./hooks/useGlobalShortcut";
import { Index } from "./routes/index";
import "./App.css";

function App() {
	// Registrar atalho global Alt+Space
	useGlobalShortcut("Alt+Space");

	// Escutar navegação via CLI
	useCliNavigation();

	return (
		<div className="flex flex-col h-screen bg-background/85 backdrop-blur-xl text-foreground">
			<main className="flex-1 overflow-auto">
				<Router>
					<Index path="/" />
				</Router>
			</main>
		</div>
	);
}

const rootElement = document.getElementById("root");
if (rootElement) {
	render(<App />, rootElement);
}
