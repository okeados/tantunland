const { GuildMember, Embed, EmbedBuilder } = require('discord.js');
const { Bot, ClientEvent } = require('../../../base/classes');
const { stripIndents } = require('common-tags');

class GuildMemberAdd extends ClientEvent {

    /**
     * @param {Bot} client
     */
    constructor(client) {
        super(client, {
            name: "guildMemberAdd"
        })
        this.client = client;
    }

    /**
     * @param {GuildMember} member
     */
    async run(member) {
        if (member.guild.id !== this.client.config.guildId) return;

        const gInvites = await member.guild.invites.fetch({ cache: false })
        const invite = this.client.invites.find((inv) => inv.uses < gInvites.get(inv.code)?.uses || !gInvites.has(inv.code));
        await member.guild.invites.fetch().then(async (invites) => {
            await this.client.redis.set(`inv_guild:${member.guild.id}`, JSON.stringify(invites.map(i => ({
                uses: i.uses,
                code: i.code,
                inviterId: i.inviterId
            }))));
        });
        let inviter = invite ? invite.inviterId : "VANITY_URL";
        await this.client.models.invites.create({
            guildId: member.guild.id,
            inviterId: inviter,
            invitedId: member.id,
            urlCode: invite ? invite.code : member.guild.vanityURLCode || "",
            left: false
        });
        const inviterMember = member.guild.members.cache.get(inviter);
        console.log(`${member.user.tag} katıldı. Davetçisi: ${inviterMember ? inviterMember.user.username : "VANITY_URL"}`);
        const colors = {
            "member": "#2ecc71",
            "guest": "#f1c40f",
            "stranger": "#e74c3c",
            "autorol": "#3498db"
        }
        const embed = new EmbedBuilder();
        embed.setAuthor({ name: `${member.user.username} [${member.user.id}]`, iconURL: member.user.displayAvatarURL() });
        embed.setFooter({
            text: `Davetçi: ${inviterMember ? inviterMember.user.username : "VANITY_URL"}`,
            iconURL: inviterMember ? inviterMember.user.displayAvatarURL() : member.guild.iconURL()
        });
        let description_lines = [];
        description_lines.push(`Aramıza hoş geldin ${member.user}!`)
        const staff = member.guild.roles.cache.get(this.client.data.roles["staff"]);
        const staffs = {
            online: staff?.members.filter(m => m.presence.status !== "offline").size,
            in_voice: staff?.members.filter(m => m.voice.channel).size,
        }
        if (!inviterMember) {
            const otorol = this.client.data.roles["autorol"];
            if (otorol && otorol.length > 0) {
                await member.roles.add(otorol, "davetçisi bulunamadı").catch(e => console.log(e));
            }
            embed.setColor(colors["autorol"]);
            description_lines.push(`Sunucuya katıldığın için teşekkür ederiz. Davetçin bulunamadığı için __otomatik rol__ olarak kayıt edildin.`);
            if (staffs.in_voice > 0) {
                description_lines.push(
                    stripIndents`Lütfen kayıt olmak için bir yetkiliye ulaşın.
                \`\`\`Sunucuda ${staffs.in_voice} yetkili seslide, ${staffs.online} yetkili çevrimiçi.\`\`\``
                );
            } else if (staffs.online > 0) {
                description_lines.push(
                    stripIndents`Lütfen kayıt olmak için bir yetkiliye ulaşın.
                    \`\`\`Sunucuda ${staffs.online} yetkili çevrimiçi fakat hiçbiri ses kanalında değil.\`\`\``
                );
            }
        } else if (inviterMember.user.bot) {
            const otorol = this.client.data.roles["stranger"];
            if (otorol && otorol.length > 0) {
                await member.roles.add(otorol, "davetçisi bot").catch(e => console.log(e));
            }
            embed.setColor(colors["stranger"]);
            description_lines.push(`Sunucuya katıldığın için teşekkür ederiz. Site üzerinden katılım sağladığın için __yabancı__ rolünü aldın.`);
            if (staffs.in_voice > 0) {
                description_lines.push(
                    stripIndents`Lütfen kayıt olmak için bir yetkiliye ulaşın.
                \`\`\`Sunucuda ${staffs.in_voice} yetkili seslide, ${staffs.online} yetkili çevrimiçi.\`\`\``
                );
            } else if (staffs.online > 0) {
                description_lines.push(
                    stripIndents`Lütfen kayıt olmak için bir yetkiliye ulaşın.
                    \`\`\`Sunucuda ${staffs.online} yetkili çevrimiçi fakat hiçbiri ses kanalında değil.\`\`\``
                );
            }
        } else if (inviterMember.user.id === member.id) {
            const otorol = this.client.data.roles["stranger"];
            if (otorol && otorol.length > 0) {
                await member.roles.add(otorol, "davetçisi kendisi").catch(e => console.log(e));
            }
            embed.setColor(colors["stranger"]);
            description_lines.push(`Sunucuya katıldığın için teşekkür ederiz. Kendi davetinle katıldığın için __yabancı__ rolünü aldın.`);
            if (staffs.in_voice > 0) {
                description_lines.push(
                    stripIndents`Lütfen kayıt olmak için bir yetkiliye ulaşın.
                \`\`\`Sunucuda ${staffs.in_voice} yetkili seslide, ${staffs.online} yetkili çevrimiçi.\`\`\``
                );
            } else if (staffs.online > 0) {
                description_lines.push(
                    stripIndents`Lütfen kayıt olmak için bir yetkiliye ulaşın.
                    \`\`\`Sunucuda ${staffs.online} yetkili çevrimiçi fakat hiçbiri ses kanalında değil.\`\`\``
                );
            }
        } else if (inviterMember.roles.cache.has(this.client.data.roles["üye"])) {
            const otorol = this.client.data.roles["guest"];
            if (otorol && otorol.length > 0) {
                await member.roles.add(otorol, "davetçisi üye").catch(e => console.log(e));
            }
            embed.setColor(colors["guest"]);
            description_lines.push(`Sunucuya katıldığın için teşekkür ederiz. ${inviterMember} tarafından davet edildiği için __misafir__ olarak kayıt edildin`);
        } else if (inviterMember.user.id === member.guild.ownerId) {
            const otorol = this.client.data.roles["member"];
            if (otorol && otorol.length > 0) {
                await member.roles.add(otorol, "davetçisi kurucu").catch(e => console.log(e));
            }
            embed.setColor(colors["member"]);
            description_lines.push(`Sunucunun kurucusu tarafından davet edildiğin için otomatik olarak __üye__ olarak kayıt edildin.`);
        }
        embed.setDescription(description_lines.join("\n"));
        await member.guild.channels.cache.get(this.client.data.channels["welcome"]).send(embed);
    }
}

module.exports = GuildMemberAdd;
