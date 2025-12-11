import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// 如果你的项目有 index.css，请保留下面这行；如果没有，请注释掉以防报错
// import '../index.css' 

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
