import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-kicker">Efeitos Colaterais — Terminal de Acesso</div>
        <div className="login-title">Identifique-se</div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
