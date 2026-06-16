import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;

    return {
      token: token || null,
      user: user || null,
      role: user?.role || null,
      isAuth: !!token,
    };
  });

  const login = ({ token, user }) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setAuth({ token, user, role: user?.role, isAuth: true });
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("activeJobId"); // optional
    setAuth({ token: null, user: null, role: null, isAuth: false });
  };

  useEffect(() => {
    const onStorage = () => {
      const token = localStorage.getItem("token");
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;

      setAuth({
        token: token || null,
        user: user || null,
        role: user?.role || null,
        isAuth: !!token,
      });
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
