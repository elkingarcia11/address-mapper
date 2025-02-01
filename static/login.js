document
  .getElementById("loginForm")
  .addEventListener("submit", function (event) {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    if (!username || !password) {
      event.preventDefault(); // Prevent form submission
      document.getElementById("errorMessage").textContent =
        "Please fill in all fields.";
    }
  });
