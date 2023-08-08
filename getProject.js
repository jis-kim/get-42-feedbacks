
import * as https from "https";
import * as fs from "fs";
import { select, confirm } from "@inquirer/prompts";
import { config } from "dotenv"

config();

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

const getProjectUsers = () => {
  options.path = `/v2/users/${user}/projects_users?page[size]=100`;
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
              feedbacks: obj.feedbacks.map((feedback) => {
                return {
                  id: feedback.id,
                  comment: feedback.comment,
                  rating: feedback.rating,
                };
              }),
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
const { access_token } = await issueToken();
options.headers = {
  Authorization: `Bearer ${access_token}`,
};

console.time("getProjects");
const projectUsers = await getProjectUsers();
console.timeEnd("getProjects");

const filteredProjectList = projectUsers.filter((obj) => !obj.project.name.includes('Exam')).map((obj) => {
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

const selectProject = async () => {
  const answer = await select({
    message: "Select projects to get scale team",
    choices: filteredProjectList.map((obj) => {
      return {
        name: obj.project.name,
        value: obj,
      };
    }),
  })

  console.log(answer);
  const promises = answer.teams.map((team) =>
    getScaleTeams(team.id),
  );

  const result = await Promise.all(promises);
  fs.writeFileSync(answer.project.name + ".json", JSON.stringify(result, null, 2));
  console.log(answer.project.name + ".json file is created.")

  const cont = await confirm({message: "Do you want to get another project?"});
  if (cont) {
    await selectProject();
  }
  else {
    console.log("Bye!")
  }
}

await selectProject();



