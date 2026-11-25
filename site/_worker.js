const worker = {
  fetch(request, env) {
    return env.PLAYTEST.fetch(request);
  },
};

export default worker;
