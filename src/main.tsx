import { createRouter, RouterProvider } from "@tanstack/solid-router";
import { render } from "solid-js/web";
import { routeTree } from "./routeTree.gen";
import "./App.css";

const router = createRouter({ routeTree });

declare module "@tanstack/solid-router" {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.getElementById("root");
if (rootElement) {
	render(() => <RouterProvider router={router} />, rootElement);
}
