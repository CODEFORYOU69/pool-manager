--
-- PostgreSQL database dump
--

-- Dumped from database version 14.11 (Homebrew)
-- Dumped by pg_dump version 14.11 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Area; Type: TABLE; Schema: public; Owner: codeforyou69
--

CREATE TABLE public."Area" (
    id text NOT NULL,
    "areaNumber" integer NOT NULL,
    "competitionId" text NOT NULL
);


ALTER TABLE public."Area" OWNER TO codeforyou69;

--
-- Name: Break; Type: TABLE; Schema: public; Owner: codeforyou69
--

CREATE TABLE public."Break" (
    id text NOT NULL,
    "startTime" timestamp(3) without time zone NOT NULL,
    "endTime" timestamp(3) without time zone NOT NULL,
    "areaId" text NOT NULL
);


ALTER TABLE public."Break" OWNER TO codeforyou69;

--
-- Name: Competition; Type: TABLE; Schema: public; Owner: codeforyou69
--

CREATE TABLE public."Competition" (
    id text NOT NULL,
    name text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "startTime" timestamp(3) without time zone NOT NULL,
    "endTime" timestamp(3) without time zone,
    "roundDuration" integer NOT NULL,
    "breakDuration" integer NOT NULL,
    "breakFrequency" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "poolSize" integer DEFAULT 4 NOT NULL
);


ALTER TABLE public."Competition" OWNER TO codeforyou69;

--
-- Name: Group; Type: TABLE; Schema: public; Owner: codeforyou69
--

CREATE TABLE public."Group" (
    id text NOT NULL,
    gender text NOT NULL,
    "ageCategoryName" text NOT NULL,
    "ageCategoryMin" integer NOT NULL,
    "ageCategoryMax" integer NOT NULL,
    "weightCategoryName" text NOT NULL,
    "weightCategoryMax" integer NOT NULL,
    "competitionId" text NOT NULL
);


ALTER TABLE public."Group" OWNER TO codeforyou69;

--
-- Name: Match; Type: TABLE; Schema: public; Owner: codeforyou69
--

CREATE TABLE public."Match" (
    id text NOT NULL,
    "matchNumber" integer NOT NULL,
    status text NOT NULL,
    "startTime" timestamp(3) without time zone NOT NULL,
    "endTime" timestamp(3) without time zone,
    winner text,
    "groupId" text NOT NULL,
    "poolId" text NOT NULL,
    "areaId" text NOT NULL,
    "poolIndex" integer NOT NULL,
    "pointMatch" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public."Match" OWNER TO codeforyou69;

--
-- Name: MatchParticipant; Type: TABLE; Schema: public; Owner: codeforyou69
--

CREATE TABLE public."MatchParticipant" (
    id text NOT NULL,
    "position" text NOT NULL,
    "matchId" text NOT NULL,
    "participantId" text NOT NULL
);


ALTER TABLE public."MatchParticipant" OWNER TO codeforyou69;

--
-- Name: Participant; Type: TABLE; Schema: public; Owner: codeforyou69
--

CREATE TABLE public."Participant" (
    id text NOT NULL,
    nom text NOT NULL,
    prenom text NOT NULL,
    sexe text NOT NULL,
    age integer NOT NULL,
    poids double precision NOT NULL,
    ligue text NOT NULL,
    "competitionId" text NOT NULL
);


ALTER TABLE public."Participant" OWNER TO codeforyou69;

--
-- Name: ParticipantGroup; Type: TABLE; Schema: public; Owner: codeforyou69
--

CREATE TABLE public."ParticipantGroup" (
    id text NOT NULL,
    "participantId" text NOT NULL,
    "groupId" text NOT NULL
);


ALTER TABLE public."ParticipantGroup" OWNER TO codeforyou69;

--
-- Name: Pool; Type: TABLE; Schema: public; Owner: codeforyou69
--

CREATE TABLE public."Pool" (
    id text NOT NULL,
    "poolIndex" integer NOT NULL,
    "groupId" text NOT NULL
);


ALTER TABLE public."Pool" OWNER TO codeforyou69;

--
-- Name: PoolParticipant; Type: TABLE; Schema: public; Owner: codeforyou69
--

CREATE TABLE public."PoolParticipant" (
    id text NOT NULL,
    "poolId" text NOT NULL,
    "participantId" text NOT NULL
);


ALTER TABLE public."PoolParticipant" OWNER TO codeforyou69;

--
-- Name: Round; Type: TABLE; Schema: public; Owner: codeforyou69
--

CREATE TABLE public."Round" (
    id text NOT NULL,
    "roundNumber" integer NOT NULL,
    "scoreA" integer DEFAULT 0 NOT NULL,
    "scoreB" integer DEFAULT 0 NOT NULL,
    winner text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "matchId" text NOT NULL,
    "winnerPosition" text
);


ALTER TABLE public."Round" OWNER TO codeforyou69;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: codeforyou69
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO codeforyou69;

--
-- Name: Area Area_pkey; Type: CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Area"
    ADD CONSTRAINT "Area_pkey" PRIMARY KEY (id);


--
-- Name: Break Break_pkey; Type: CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Break"
    ADD CONSTRAINT "Break_pkey" PRIMARY KEY (id);


--
-- Name: Competition Competition_pkey; Type: CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Competition"
    ADD CONSTRAINT "Competition_pkey" PRIMARY KEY (id);


--
-- Name: Group Group_pkey; Type: CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Group"
    ADD CONSTRAINT "Group_pkey" PRIMARY KEY (id);


--
-- Name: MatchParticipant MatchParticipant_pkey; Type: CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."MatchParticipant"
    ADD CONSTRAINT "MatchParticipant_pkey" PRIMARY KEY (id);


--
-- Name: Match Match_pkey; Type: CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Match"
    ADD CONSTRAINT "Match_pkey" PRIMARY KEY (id);


--
-- Name: ParticipantGroup ParticipantGroup_pkey; Type: CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."ParticipantGroup"
    ADD CONSTRAINT "ParticipantGroup_pkey" PRIMARY KEY (id);


--
-- Name: Participant Participant_pkey; Type: CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Participant"
    ADD CONSTRAINT "Participant_pkey" PRIMARY KEY (id);


--
-- Name: PoolParticipant PoolParticipant_pkey; Type: CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."PoolParticipant"
    ADD CONSTRAINT "PoolParticipant_pkey" PRIMARY KEY (id);


--
-- Name: Pool Pool_pkey; Type: CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Pool"
    ADD CONSTRAINT "Pool_pkey" PRIMARY KEY (id);


--
-- Name: Round Round_pkey; Type: CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Round"
    ADD CONSTRAINT "Round_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Area_competitionId_idx; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE INDEX "Area_competitionId_idx" ON public."Area" USING btree ("competitionId");


--
-- Name: Break_areaId_idx; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE INDEX "Break_areaId_idx" ON public."Break" USING btree ("areaId");


--
-- Name: Group_competitionId_idx; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE INDEX "Group_competitionId_idx" ON public."Group" USING btree ("competitionId");


--
-- Name: MatchParticipant_matchId_idx; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE INDEX "MatchParticipant_matchId_idx" ON public."MatchParticipant" USING btree ("matchId");


--
-- Name: MatchParticipant_matchId_position_key; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE UNIQUE INDEX "MatchParticipant_matchId_position_key" ON public."MatchParticipant" USING btree ("matchId", "position");


--
-- Name: MatchParticipant_participantId_idx; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE INDEX "MatchParticipant_participantId_idx" ON public."MatchParticipant" USING btree ("participantId");


--
-- Name: Match_areaId_idx; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE INDEX "Match_areaId_idx" ON public."Match" USING btree ("areaId");


--
-- Name: Match_groupId_idx; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE INDEX "Match_groupId_idx" ON public."Match" USING btree ("groupId");


--
-- Name: Match_poolId_idx; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE INDEX "Match_poolId_idx" ON public."Match" USING btree ("poolId");


--
-- Name: ParticipantGroup_groupId_idx; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE INDEX "ParticipantGroup_groupId_idx" ON public."ParticipantGroup" USING btree ("groupId");


--
-- Name: ParticipantGroup_participantId_groupId_key; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE UNIQUE INDEX "ParticipantGroup_participantId_groupId_key" ON public."ParticipantGroup" USING btree ("participantId", "groupId");


--
-- Name: ParticipantGroup_participantId_idx; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE INDEX "ParticipantGroup_participantId_idx" ON public."ParticipantGroup" USING btree ("participantId");


--
-- Name: Participant_competitionId_idx; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE INDEX "Participant_competitionId_idx" ON public."Participant" USING btree ("competitionId");


--
-- Name: PoolParticipant_participantId_idx; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE INDEX "PoolParticipant_participantId_idx" ON public."PoolParticipant" USING btree ("participantId");


--
-- Name: PoolParticipant_poolId_idx; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE INDEX "PoolParticipant_poolId_idx" ON public."PoolParticipant" USING btree ("poolId");


--
-- Name: PoolParticipant_poolId_participantId_key; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE UNIQUE INDEX "PoolParticipant_poolId_participantId_key" ON public."PoolParticipant" USING btree ("poolId", "participantId");


--
-- Name: Pool_groupId_idx; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE INDEX "Pool_groupId_idx" ON public."Pool" USING btree ("groupId");


--
-- Name: Round_matchId_idx; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE INDEX "Round_matchId_idx" ON public."Round" USING btree ("matchId");


--
-- Name: Round_matchId_roundNumber_key; Type: INDEX; Schema: public; Owner: codeforyou69
--

CREATE UNIQUE INDEX "Round_matchId_roundNumber_key" ON public."Round" USING btree ("matchId", "roundNumber");


--
-- Name: Area Area_competitionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Area"
    ADD CONSTRAINT "Area_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES public."Competition"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Break Break_areaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Break"
    ADD CONSTRAINT "Break_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES public."Area"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Group Group_competitionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Group"
    ADD CONSTRAINT "Group_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES public."Competition"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MatchParticipant MatchParticipant_matchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."MatchParticipant"
    ADD CONSTRAINT "MatchParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES public."Match"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MatchParticipant MatchParticipant_participantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."MatchParticipant"
    ADD CONSTRAINT "MatchParticipant_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES public."Participant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Match Match_areaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Match"
    ADD CONSTRAINT "Match_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES public."Area"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Match Match_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Match"
    ADD CONSTRAINT "Match_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public."Group"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Match Match_poolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Match"
    ADD CONSTRAINT "Match_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES public."Pool"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ParticipantGroup ParticipantGroup_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."ParticipantGroup"
    ADD CONSTRAINT "ParticipantGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public."Group"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ParticipantGroup ParticipantGroup_participantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."ParticipantGroup"
    ADD CONSTRAINT "ParticipantGroup_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES public."Participant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Participant Participant_competitionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Participant"
    ADD CONSTRAINT "Participant_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES public."Competition"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PoolParticipant PoolParticipant_participantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."PoolParticipant"
    ADD CONSTRAINT "PoolParticipant_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES public."Participant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PoolParticipant PoolParticipant_poolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."PoolParticipant"
    ADD CONSTRAINT "PoolParticipant_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES public."Pool"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Pool Pool_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Pool"
    ADD CONSTRAINT "Pool_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public."Group"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Round Round_matchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: codeforyou69
--

ALTER TABLE ONLY public."Round"
    ADD CONSTRAINT "Round_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES public."Match"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

