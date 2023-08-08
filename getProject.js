const https = require("https");
const fs = require("fs");
const readline = require("readline");

require("dotenv").config();

const errorCallback = (err) => {
  if (err) console.error(err);
};


const issueToken = () => {
  return new Promise((resolve, reject) => {
    const tokenOptions = {
      hostname: "api.intra.42.fr",
      path: "/oauth/token",
      method: "POST",
    };
    const id = process.env.CLIENT_ID;
    const secret = process.env.CLIENT_SECRET;
    const data = `grant_type=client_credentials&client_id=${id}&client_secret=${secret}`;

    const request = https
      .request(tokenOptions, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve(JSON.parse(data));
        });
      })
      .on("error", (err) => {
        reject(err);
      });

    request.write(data);
    request.end();
  });
};

const user = "jiskim";
const options = {
  hostname: "api.intra.42.fr",
  path: `/v2/users/${user}`,
  method: "GET",
};

const getProjects = () => {
  console.time("getProjects");
  options.path = `/v2/users/${user}/projects_users`;
  return new Promise((resolve, reject) => {
    const request = https
      .request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve(JSON.parse(data));
        });
      })
      .on("error", (err) => {
        reject(err);
      });
    request.end();
  });
};

const getScaleTeams = (teamId) => {
  options.path = `/v2/scale_teams?filter[team_id]=${teamId}`;
  return new Promise((resolve, reject) => {
    https
      .get(options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          const parsed = JSON.parse(data).map((obj) => {
            return {
              id: obj.id,
              scale_id: obj.scale_id,
              final_mark: obj.final_mark,
              flag: {
                name: obj.flag.name,
                positive: obj.flag.positive,
              },
              comment: {
                author_id: obj.corrector.id,
                author_name: obj.corrector.login,
                comment: obj.comment,
              },
              feedbacks: obj.feedbacks,
            };
          });
          resolve(parsed);
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

issueToken().then((res) => {
  options.headers = {
    Authorization: `Bearer ${res.access_token}`,
  };
  getProjects()
    .then((res) => {
      console.timeEnd("getProjects");
      console.time("mapping projectList")
      const projectList = res.map((obj) => {
        return {
          project: {
            id: obj.project.id,
            name: obj.project.name,
            slug: obj.project.slug,
          },
          teams: obj.teams.map((team) => {
            return {
              id: team.id,
              name: team.name,
              final_mark: team.final_mark,
              status: team.status,
            };
          }),
        };
      });
      console.timeEnd("mapping projectList")
      projectList.forEach((obj) => {
        console.log("id: ", obj.project.id, ", name: ", obj.project.name);
      });
      fs.writeFile(
        "projects.json",
        JSON.stringify(projectList, null, 2),
        errorCallback,
      );

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const askQuestion = () => {
        rl.question("\nEnter project name to get scale team: ", (data) => {
          const filtered = projectList.filter((obj) => {
            return obj.project.name === data;
          });
          if (filtered.length === 0) {
            console.log("\nNo project found. try again.");
            askQuestion();
          } else {
            console.log(filtered[0].teams);
            const promises = filtered[0].teams.map((team) =>
              getScaleTeams(team.id),
            );
            Promise.all(promises).then((res) => {
              fs.writeFile(
                "scaleTeams.json",
                JSON.stringify(res, null, 2),
                errorCallback,
              );
            });
            rl.close();
          }
        });
      };
      askQuestion();
    })
    .catch((err) => {
      console.error(err);
    });
});
