import SignupForm from "./SignupForm";

export default function SignupPage() {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-kicker">Efeitos Colaterais — Novo cadastro</div>
        <div className="login-title">Criar identidade</div>
        <SignupForm />
      </div>
    </div>
  );
}
