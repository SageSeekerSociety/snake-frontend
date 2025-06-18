import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./style.css";
import './styles/common.css'

window.addEventListener("keydown", (event: KeyboardEvent) => {
  if ([37, 38, 39, 40].includes(event.keyCode)) {
    event.preventDefault();
  }
});

const app = createApp(App);
app.use(router);
app.mount("#app");
